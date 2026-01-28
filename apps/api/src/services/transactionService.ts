import { getDatabase } from '../db/database.js';
import { AppError } from '../errors.js';
import { type TransactionWithCategory, type ConfirmTransactionsRequest } from '@compasso/shared';
import { yearRange, monthRange } from '../utils/dateHelpers.js';

interface TransactionFilters {
  workspaceId: number;
  year?: number;
  month?: number;
  categoryId?: number;
  isIncome?: boolean;
  search?: string;
  limit?: number;
  offset?: number;
}

interface TransactionListResult {
  items: TransactionWithCategory[];
  total: number;
  limit: number;
  offset: number;
}

function buildTransactionFilters(filters: TransactionFilters): { where: string; params: unknown[] } {
  const conditions: string[] = ['l.workspace_id = ?'];
  const params: unknown[] = [filters.workspaceId];

  if (filters.year && filters.month) {
    const range = monthRange(filters.year, filters.month);
    conditions.push('t.date >= ? AND t.date < ?');
    params.push(range.start, range.end);
  } else if (filters.year) {
    const range = yearRange(filters.year);
    conditions.push('t.date >= ? AND t.date < ?');
    params.push(range.start, range.end);
  }

  if (filters.categoryId !== undefined) {
    conditions.push('t.category_id = ?');
    params.push(filters.categoryId);
  }

  if (filters.isIncome !== undefined) {
    conditions.push('t.is_income = ?');
    params.push(filters.isIncome ? 1 : 0);
  }

  if (filters.search) {
    conditions.push('t.description LIKE ?');
    params.push(`%${filters.search}%`);
  }

  return { where: `WHERE ${conditions.join(' AND ')}`, params };
}

function mapTransactionRow(r: any): TransactionWithCategory {
  return {
    id: r.id,
    ledgerId: r.ledger_id,
    date: r.date,
    description: r.description,
    amount: r.amount,
    balance: r.balance,
    categoryId: r.category_id,
    isIncome: r.is_income === 1,
    rawText: r.raw_text,
    createdAt: r.created_at,
    recurringPatternId: r.recurring_pattern_id,
    bankId: r.bank_id,
    category: r.cat_id
      ? {
          id: r.cat_id,
          name: r.cat_name!,
          color: r.cat_color,
          icon: r.cat_icon,
          isDefault: r.cat_is_default === 1,
          createdAt: r.cat_created_at!,
        }
      : null,
  };
}

/**
 * List transactions with filtering and pagination.
 */
export function listTransactions(filters: TransactionFilters): TransactionListResult {
  const db = getDatabase();
  const limit = filters.limit ?? 50;
  const offset = filters.offset ?? 0;
  const { where, params } = buildTransactionFilters(filters);

  const countResult = db
    .prepare(`SELECT COUNT(*) as count FROM transactions t JOIN ledgers l ON t.ledger_id = l.id ${where}`)
    .get(...params) as { count: number };

  const results = db
    .prepare(
      `
      SELECT
        t.id, t.ledger_id, t.date, t.description, t.amount, t.balance,
        t.category_id, t.is_income, t.raw_text, t.created_at, t.recurring_pattern_id,
        l.bank_id,
        c.id as cat_id, c.name as cat_name, c.color as cat_color,
        c.icon as cat_icon, c.is_default as cat_is_default, c.created_at as cat_created_at
      FROM transactions t
      JOIN ledgers l ON t.ledger_id = l.id
      LEFT JOIN categories c ON t.category_id = c.id
      ${where}
      ORDER BY t.date DESC, t.id DESC
      LIMIT ? OFFSET ?
    `
    )
    .all(...params, limit, offset) as any[];

  return {
    items: results.map(mapTransactionRow),
    total: countResult.count,
    limit,
    offset,
  };
}

/**
 * Export all transactions matching filters (no pagination).
 */
export function exportTransactions(
  filters: Omit<TransactionFilters, 'limit' | 'offset'>
): Array<{ date: string; description: string; isIncome: boolean; amount: number; categoryName: string; balance: number | null }> {
  const db = getDatabase();
  const { where, params } = buildTransactionFilters(filters);

  const results = db.prepare(`
    SELECT t.date, t.description, t.amount, t.balance, t.is_income,
           COALESCE(c.name, 'Uncategorized') as category_name
    FROM transactions t
    JOIN ledgers l ON t.ledger_id = l.id
    LEFT JOIN categories c ON t.category_id = c.id
    ${where}
    ORDER BY t.date DESC, t.id DESC
  `).all(...params) as any[];

  return results.map((r) => ({
    date: r.date,
    description: r.description,
    isIncome: r.is_income === 1,
    amount: r.amount,
    categoryName: r.category_name,
    balance: r.balance,
  }));
}

/**
 * Confirm and insert a batch of transactions for a ledger.
 */
export function confirmTransactions(
  ledgerId: number,
  transactions: ConfirmTransactionsRequest['transactions']
): number {
  if (!ledgerId || !transactions || !Array.isArray(transactions)) {
    throw AppError.badRequest('Invalid request: ledgerId and transactions array required');
  }

  const db = getDatabase();

  const ledger = db
    .prepare('SELECT id FROM ledgers WHERE id = ?')
    .get(ledgerId);

  if (!ledger) {
    throw AppError.notFound('Ledger not found');
  }

  const insert = db.prepare(`
    INSERT INTO transactions (ledger_id, date, description, amount, balance, category_id, is_income, raw_text)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertMany = db.transaction((txs: ConfirmTransactionsRequest['transactions']) => {
    for (const tx of txs) {
      insert.run(
        ledgerId,
        tx.date,
        tx.description,
        tx.amount,
        tx.balance,
        tx.categoryId,
        tx.isIncome ? 1 : 0,
        tx.rawText
      );
    }
  });

  insertMany(transactions);

  return transactions.length;
}

/**
 * Update a transaction's category within a workspace.
 */
export function updateTransactionCategory(
  transactionId: number,
  categoryId: number | null,
  workspaceId: number
): void {
  if (!workspaceId) {
    throw AppError.badRequest('workspaceId is required');
  }

  const db = getDatabase();

  // Mark as manually categorized so auto-recategorization won't override this choice.
  const result = db
    .prepare(`
      UPDATE transactions
      SET category_id = ?, is_manual = 1
      WHERE id = ? AND ledger_id IN (SELECT id FROM ledgers WHERE workspace_id = ?)
    `)
    .run(categoryId, transactionId, workspaceId);

  if (result.changes === 0) {
    throw AppError.notFound('Transaction not found');
  }
}

/**
 * Delete a transaction, verifying the user has access via workspace membership.
 */
export function deleteTransaction(transactionId: number, userId: number): void {
  if (isNaN(transactionId)) {
    throw AppError.badRequest('Invalid transaction ID');
  }

  const db = getDatabase();

  const tx = db.prepare(`
    SELECT t.id
    FROM transactions t
    JOIN ledgers l ON t.ledger_id = l.id
    JOIN workspace_members wm ON wm.workspace_id = l.workspace_id
    WHERE t.id = ? AND wm.user_id = ?
  `).get(transactionId, userId) as { id: number } | undefined;

  if (!tx) {
    throw AppError.notFound('Transaction not found');
  }

  db.prepare('DELETE FROM transactions WHERE id = ?').run(transactionId);
}
