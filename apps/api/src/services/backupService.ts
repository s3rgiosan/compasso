import { getDatabase } from '../db/database.js';

interface BackupCategory {
  name: string;
  color: string | null;
  icon: string | null;
  isDefault: boolean;
  patterns: Array<{
    bankId: string;
    pattern: string;
    priority: number;
  }>;
}

interface BackupTransaction {
  date: string;
  description: string;
  amount: number;
  balance: number | null;
  categoryName: string | null;
  isIncome: boolean;
  isManual: boolean;
  rawText: string | null;
}

interface BackupLedger {
  filename: string;
  uploadDate: string;
  periodStart: string | null;
  periodEnd: string | null;
  bankId: string;
  fileHash: string | null;
  transactions: BackupTransaction[];
}

interface BackupRecurringPattern {
  descriptionPattern: string;
  frequency: string;
  avgAmount: number;
  occurrenceCount: number;
  isActive: boolean;
}

export interface WorkspaceBackup {
  version: number;
  exportedAt: string;
  workspace: {
    name: string;
    description: string | null;
    color: string;
    icon: string;
  };
  categories: BackupCategory[];
  ledgers: BackupLedger[];
  recurringPatterns: BackupRecurringPattern[];
}

export interface ImportStats {
  categoriesImported: number;
  categoriesSkipped: number;
  patternsImported: number;
  patternsSkipped: number;
  ledgersImported: number;
  ledgersSkipped: number;
  transactionsImported: number;
  recurringPatternsImported: number;
  recurringPatternsSkipped: number;
}

/**
 * Exports all workspace data as a self-contained JSON backup.
 * Includes categories with patterns, ledgers with transactions,
 * and recurring patterns. Transactions reference categories by name (not ID)
 * so the backup is portable across workspaces.
 */
export function exportWorkspaceData(workspaceId: number): WorkspaceBackup {
  const db = getDatabase();

  // Workspace metadata
  const workspace = db
    .prepare('SELECT name, description, color, icon FROM workspaces WHERE id = ?')
    .get(workspaceId) as { name: string; description: string | null; color: string; icon: string };

  // Categories with patterns
  const categories = db
    .prepare('SELECT id, name, color, icon, is_default FROM categories WHERE workspace_id = ?')
    .all(workspaceId) as Array<{ id: number; name: string; color: string | null; icon: string | null; is_default: number }>;

  // Fetch all patterns in a single query instead of per-category
  const allPatterns = db
    .prepare(`
      SELECT cp.bank_id, cp.pattern, cp.priority, cp.category_id
      FROM category_patterns cp
      JOIN categories c ON cp.category_id = c.id
      WHERE c.workspace_id = ?
    `)
    .all(workspaceId) as Array<{ bank_id: string; pattern: string; priority: number; category_id: number }>;

  const patternsByCategory = new Map<number, Array<{ bank_id: string; pattern: string; priority: number }>>();
  for (const p of allPatterns) {
    const list = patternsByCategory.get(p.category_id) || [];
    list.push(p);
    patternsByCategory.set(p.category_id, list);
  }

  const backupCategories: BackupCategory[] = categories.map((cat) => {
    const patterns = patternsByCategory.get(cat.id) || [];

    return {
      name: cat.name,
      color: cat.color,
      icon: cat.icon,
      isDefault: cat.is_default === 1,
      patterns: patterns.map((p) => ({
        bankId: p.bank_id,
        pattern: p.pattern,
        priority: p.priority,
      })),
    };
  });

  // Ledgers with transactions (join category name)
  const ledgers = db
    .prepare('SELECT id, filename, upload_date, period_start, period_end, bank_id, file_hash FROM ledgers WHERE workspace_id = ?')
    .all(workspaceId) as Array<{
    id: number;
    filename: string;
    upload_date: string;
    period_start: string | null;
    period_end: string | null;
    bank_id: string;
    file_hash: string | null;
  }>;

  // Fetch all transactions in a single query instead of per-ledger
  const allTransactions = db
    .prepare(`
      SELECT t.ledger_id, t.date, t.description, t.amount, t.balance,
             c.name as category_name, t.is_income, t.is_manual, t.raw_text
      FROM transactions t
      JOIN ledgers l ON t.ledger_id = l.id
      LEFT JOIN categories c ON t.category_id = c.id
      WHERE l.workspace_id = ?
      ORDER BY t.date, t.id
    `)
    .all(workspaceId) as Array<{
    ledger_id: number;
    date: string;
    description: string;
    amount: number;
    balance: number | null;
    category_name: string | null;
    is_income: number;
    is_manual: number;
    raw_text: string | null;
  }>;

  const txByLedger = new Map<number, typeof allTransactions>();
  for (const t of allTransactions) {
    const list = txByLedger.get(t.ledger_id) || [];
    list.push(t);
    txByLedger.set(t.ledger_id, list);
  }

  const backupLedgers: BackupLedger[] = ledgers.map((ledger) => {
    const transactions = txByLedger.get(ledger.id) || [];

    return {
      filename: ledger.filename,
      uploadDate: ledger.upload_date,
      periodStart: ledger.period_start,
      periodEnd: ledger.period_end,
      bankId: ledger.bank_id,
      fileHash: ledger.file_hash,
      transactions: transactions.map((t) => ({
        date: t.date,
        description: t.description,
        amount: t.amount,
        balance: t.balance,
        categoryName: t.category_name,
        isIncome: t.is_income === 1,
        isManual: t.is_manual === 1,
        rawText: t.raw_text,
      })),
    };
  });

  // Recurring patterns
  const recurringPatterns = db
    .prepare('SELECT description_pattern, frequency, avg_amount, occurrence_count, is_active FROM recurring_patterns WHERE workspace_id = ?')
    .all(workspaceId) as Array<{
    description_pattern: string;
    frequency: string;
    avg_amount: number;
    occurrence_count: number;
    is_active: number;
  }>;

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    workspace: {
      name: workspace.name,
      description: workspace.description,
      color: workspace.color,
      icon: workspace.icon,
    },
    categories: backupCategories,
    ledgers: backupLedgers,
    recurringPatterns: recurringPatterns.map((rp) => ({
      descriptionPattern: rp.description_pattern,
      frequency: rp.frequency,
      avgAmount: rp.avg_amount,
      occurrenceCount: rp.occurrence_count,
      isActive: rp.is_active === 1,
    })),
  };
}

/**
 * Imports workspace data from a JSON backup within a single transaction.
 * Categories are matched by name to avoid duplicates; ledgers are
 * deduplicated by file_hash. Transaction category references are resolved
 * from name to ID using the (potentially newly created) category map.
 */
export function importWorkspaceData(workspaceId: number, backup: WorkspaceBackup): ImportStats {
  const db = getDatabase();

  const stats: ImportStats = {
    categoriesImported: 0,
    categoriesSkipped: 0,
    patternsImported: 0,
    patternsSkipped: 0,
    ledgersImported: 0,
    ledgersSkipped: 0,
    transactionsImported: 0,
    recurringPatternsImported: 0,
    recurringPatternsSkipped: 0,
  };

  const importTransaction = db.transaction(() => {
    // Build category name-to-ID map (existing categories in workspace)
    const existingCategories = db
      .prepare('SELECT id, name FROM categories WHERE workspace_id = ?')
      .all(workspaceId) as Array<{ id: number; name: string }>;

    const categoryMap = new Map<string, number>();
    for (const cat of existingCategories) {
      categoryMap.set(cat.name, cat.id);
    }

    // Import categories
    for (const cat of backup.categories) {
      if (categoryMap.has(cat.name)) {
        stats.categoriesSkipped++;
      } else {
        const result = db
          .prepare('INSERT INTO categories (name, color, icon, is_default, workspace_id) VALUES (?, ?, ?, ?, ?)')
          .run(cat.name, cat.color, cat.icon, cat.isDefault ? 1 : 0, workspaceId);
        const newId = Number(result.lastInsertRowid);
        categoryMap.set(cat.name, newId);
        stats.categoriesImported++;
      }

      // Import patterns for this category
      const categoryId = categoryMap.get(cat.name)!;
      for (const pattern of cat.patterns) {
        const existing = db
          .prepare(`
            SELECT id FROM category_patterns
            WHERE category_id IN (SELECT id FROM categories WHERE workspace_id = ?)
              AND pattern = ? AND bank_id = ?
          `)
          .get(workspaceId, pattern.pattern, pattern.bankId);

        if (existing) {
          stats.patternsSkipped++;
        } else {
          db.prepare('INSERT INTO category_patterns (category_id, bank_id, pattern, priority) VALUES (?, ?, ?, ?)')
            .run(categoryId, pattern.bankId, pattern.pattern, pattern.priority);
          stats.patternsImported++;
        }
      }
    }

    // Import ledgers
    for (const ledger of backup.ledgers) {
      // Skip if file_hash exists in this workspace
      if (ledger.fileHash) {
        const existing = db
          .prepare('SELECT id FROM ledgers WHERE file_hash = ? AND workspace_id = ?')
          .get(ledger.fileHash, workspaceId);

        if (existing) {
          stats.ledgersSkipped++;
          continue;
        }
      }

      const ledgerResult = db
        .prepare('INSERT INTO ledgers (filename, upload_date, period_start, period_end, bank_id, file_hash, workspace_id) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .run(
          ledger.filename,
          ledger.uploadDate,
          ledger.periodStart,
          ledger.periodEnd,
          ledger.bankId,
          ledger.fileHash,
          workspaceId
        );
      const ledgerId = Number(ledgerResult.lastInsertRowid);
      stats.ledgersImported++;

      // Import transactions for this ledger
      const insertTx = db.prepare(`
        INSERT INTO transactions (ledger_id, date, description, amount, balance, category_id, is_income, is_manual, raw_text)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const tx of ledger.transactions) {
        const categoryId = tx.categoryName ? (categoryMap.get(tx.categoryName) ?? null) : null;
        insertTx.run(
          ledgerId,
          tx.date,
          tx.description,
          tx.amount,
          tx.balance,
          categoryId,
          tx.isIncome ? 1 : 0,
          tx.isManual ? 1 : 0,
          tx.rawText
        );
        stats.transactionsImported++;
      }
    }

    // Import recurring patterns
    for (const rp of backup.recurringPatterns) {
      const existing = db
        .prepare('SELECT id FROM recurring_patterns WHERE workspace_id = ? AND description_pattern = ?')
        .get(workspaceId, rp.descriptionPattern);

      if (existing) {
        stats.recurringPatternsSkipped++;
      } else {
        db.prepare(`
          INSERT INTO recurring_patterns (workspace_id, description_pattern, frequency, avg_amount, occurrence_count, is_active)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(workspaceId, rp.descriptionPattern, rp.frequency, rp.avgAmount, rp.occurrenceCount, rp.isActive ? 1 : 0);
        stats.recurringPatternsImported++;
      }
    }
  });

  importTransaction();

  return stats;
}
