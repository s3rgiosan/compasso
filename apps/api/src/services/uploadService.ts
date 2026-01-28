import { getDatabase } from '../db/database.js';
import { BANK_CONFIGS, getParser } from '../parsers/registry.js';
import { applyCategorySuggestions } from './categoryMatcher.js';
import { AppError } from '../errors.js';
import type { UploadResponse } from '@compasso/shared';

interface LedgerListResult {
  items: Array<{
    id: number;
    filename: string;
    uploadDate: string;
    periodStart: string | null;
    periodEnd: string | null;
    bankId: string;
    workspaceId: number;
    transactionCount: number;
  }>;
  total: number;
  limit: number;
  offset: number;
}

/**
 * Process a PDF upload: parse, deduplicate by hash, create ledger, and apply category suggestions.
 */
export async function processUpload(
  buffer: Buffer,
  filename: string,
  bankId: string,
  workspaceId: number
): Promise<UploadResponse> {
  const parse = getParser(bankId);
  if (!parse) {
    throw AppError.badRequest(
      `Unsupported bank: ${bankId}. Supported banks: ${Object.keys(BANK_CONFIGS).join(', ')}`
    );
  }

  // Parse the PDF based on bank
  const parseResult = await parse(buffer);

  const db = getDatabase();

  // Check for duplicate upload in this workspace
  const existingLedger = db
    .prepare('SELECT id, filename FROM ledgers WHERE file_hash = ? AND workspace_id = ?')
    .get(parseResult.fileHash, workspaceId) as { id: number; filename: string } | undefined;

  if (existingLedger) {
    db.prepare('DELETE FROM ledgers WHERE id = ?').run(existingLedger.id);
  }

  // Create ledger record
  const ledgerResult = db
    .prepare(
      'INSERT INTO ledgers (filename, period_start, period_end, bank_id, file_hash, workspace_id) VALUES (?, ?, ?, ?, ?, ?)'
    )
    .run(
      filename,
      parseResult.periodStart,
      parseResult.periodEnd,
      bankId,
      parseResult.fileHash,
      workspaceId
    );

  const ledgerId = ledgerResult.lastInsertRowid as number;

  // Apply category suggestions
  const transactionsWithCategories = applyCategorySuggestions(
    parseResult.transactions,
    bankId,
    workspaceId
  );

  return {
    ledgerId,
    filename,
    bankId,
    transactionCount: transactionsWithCategories.length,
    transactions: transactionsWithCategories,
    periodStart: parseResult.periodStart,
    periodEnd: parseResult.periodEnd,
  };
}

/**
 * List ledgers for a workspace with pagination and transaction counts.
 */
export function listLedgers(workspaceId: number, limit: number, offset: number): LedgerListResult {
  const db = getDatabase();

  const countResult = db
    .prepare('SELECT COUNT(*) as count FROM ledgers WHERE workspace_id = ?')
    .get(workspaceId) as { count: number };

  const ledgers = db
    .prepare(
      `
      SELECT
        l.id, l.filename, l.upload_date, l.period_start, l.period_end,
        l.bank_id, l.workspace_id,
        COUNT(t.id) as transaction_count
      FROM ledgers l
      LEFT JOIN transactions t ON l.id = t.ledger_id
      WHERE l.workspace_id = ?
      GROUP BY l.id
      ORDER BY l.upload_date DESC
      LIMIT ? OFFSET ?
    `
    )
    .all(workspaceId, limit, offset) as Array<{
    id: number;
    filename: string;
    upload_date: string;
    period_start: string | null;
    period_end: string | null;
    bank_id: string;
    workspace_id: number;
    transaction_count: number;
  }>;

  return {
    items: ledgers.map((l) => ({
      id: l.id,
      filename: l.filename,
      uploadDate: l.upload_date,
      periodStart: l.period_start,
      periodEnd: l.period_end,
      bankId: l.bank_id,
      workspaceId: l.workspace_id,
      transactionCount: l.transaction_count,
    })),
    total: countResult.count,
    limit,
    offset,
  };
}

/**
 * Delete a ledger, verifying the user has access via workspace membership.
 */
export function deleteLedger(ledgerId: number, userId: number): void {
  if (isNaN(ledgerId)) {
    throw AppError.badRequest('Invalid ledger ID');
  }

  const db = getDatabase();

  const ledger = db.prepare(`
    SELECT l.id
    FROM ledgers l
    JOIN workspace_members wm ON wm.workspace_id = l.workspace_id
    WHERE l.id = ? AND wm.user_id = ?
  `).get(ledgerId, userId) as { id: number } | undefined;

  if (!ledger) {
    throw AppError.notFound('Ledger not found');
  }

  db.prepare('DELETE FROM ledgers WHERE id = ?').run(ledgerId);
}

/**
 * Get the workspace ID for a given ledger.
 */
export function getLedgerWorkspaceId(ledgerId: number): number {
  const db = getDatabase();
  const row = db
    .prepare('SELECT workspace_id FROM ledgers WHERE id = ?')
    .get(ledgerId) as { workspace_id: number } | undefined;
  if (!row) throw AppError.notFound('Ledger not found');
  return row.workspace_id;
}
