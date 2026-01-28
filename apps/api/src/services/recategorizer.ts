import { getDatabase } from '../db/database.js';
import { matchCategory } from './categoryMatcher.js';
import type { BankId } from '@compasso/shared';

interface RecategorizeResult {
  totalChecked: number;
  recategorized: number;
}

/**
 * Re-categorize transactions when a new pattern is added.
 * Only affects transactions that:
 * - Are in the "Other" category or have no category
 * - Were not manually categorized (is_manual = 0)
 * - Belong to the specified workspace and bank
 */
export function recategorizeByPattern(
  bankId: BankId,
  workspaceId: number,
  newCategoryId: number
): RecategorizeResult {
  const db = getDatabase();

  // Get the "Other" category ID for this workspace
  const otherCategory = db
    .prepare("SELECT id FROM categories WHERE name = 'Other' AND workspace_id = ?")
    .get(workspaceId) as { id: number } | undefined;

  const otherCategoryId = otherCategory?.id;

  // Find transactions that are candidates for recategorization:
  // - Not manually categorized
  // - In "Other" category OR no category
  // - From ledgers matching the bank and workspace
  const candidateTransactions = db
    .prepare(
      `
      SELECT t.id, t.description, l.bank_id
      FROM transactions t
      JOIN ledgers l ON t.ledger_id = l.id
      WHERE l.workspace_id = ?
        AND l.bank_id = ?
        AND (t.is_manual = 0 OR t.is_manual IS NULL)
        AND (t.category_id IS NULL ${otherCategoryId ? 'OR t.category_id = ?' : ''})
    `
    )
    .all(...(otherCategoryId ? [workspaceId, bankId, otherCategoryId] : [workspaceId, bankId])) as Array<{
    id: number;
    description: string;
    bank_id: string;
  }>;

  let recategorized = 0;

  // Prepare update statement
  const updateStmt = db.prepare(
    'UPDATE transactions SET category_id = ? WHERE id = ?'
  );

  // Process each candidate transaction
  for (const tx of candidateTransactions) {
    const match = matchCategory(tx.description, tx.bank_id as BankId, workspaceId);

    // Only update if it matches the new category
    // This ensures we respect the full pattern matching logic including exclusions
    if (match && match.categoryId === newCategoryId) {
      updateStmt.run(newCategoryId, tx.id);
      recategorized++;
    }
  }

  return {
    totalChecked: candidateTransactions.length,
    recategorized,
  };
}
