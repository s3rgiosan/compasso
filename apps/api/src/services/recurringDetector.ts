import { getDatabase } from '../db/database.js';
import type { RecurringFrequency, TransactionWithCategory, RecurringSummary } from '@compasso/shared';
import { AppError } from '../errors.js';

interface TransactionRow {
  id: number;
  description: string;
  amount: number;
  date: string;
  is_income: number;
}

interface TransactionGroup {
  normalizedDescription: string;
  transactions: TransactionRow[];
}

interface DetectedPattern {
  descriptionPattern: string;
  frequency: RecurringFrequency;
  avgAmount: number;
  transactionIds: number[];
}

// Normalize description for grouping
function normalizeDescription(description: string): string {
  return description
    .toUpperCase()
    .replace(/\d{2}\/\d{2}\/\d{4}/g, '') // Remove dates
    .replace(/\d{4}-\d{2}-\d{2}/g, '') // Remove ISO dates
    .replace(/\b\d{6,}\b/g, '') // Remove long numbers (reference numbers)
    .replace(/\s+/g, ' ')
    .trim();
}

// Calculate average interval between dates in days
function calculateAverageInterval(dates: string[]): number {
  if (dates.length < 2) return 0;

  const sortedDates = dates.map(d => new Date(d).getTime()).sort((a, b) => a - b);
  let totalInterval = 0;

  for (let i = 1; i < sortedDates.length; i++) {
    totalInterval += (sortedDates[i] - sortedDates[i - 1]) / (1000 * 60 * 60 * 24);
  }

  return totalInterval / (sortedDates.length - 1);
}

/**
 * Maps average transaction interval to a frequency label.
 * Ranges accommodate real-world billing variation:
 * weekly (5-9d), monthly (25-35d), yearly (350-380d).
 */
function detectFrequency(avgInterval: number): RecurringFrequency | null {
  // Weekly: 5-9 days
  if (avgInterval >= 5 && avgInterval <= 9) {
    return 'weekly';
  }
  // Monthly: 25-35 days
  if (avgInterval >= 25 && avgInterval <= 35) {
    return 'monthly';
  }
  // Yearly: 350-380 days
  if (avgInterval >= 350 && avgInterval <= 380) {
    return 'yearly';
  }
  return null;
}

// Calculate standard deviation to filter out inconsistent intervals
function calculateStdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const squareDiffs = values.map(value => Math.pow(value - mean, 2));
  return Math.sqrt(squareDiffs.reduce((a, b) => a + b, 0) / values.length);
}

// Check if intervals are consistent (low variance)
function areIntervalsConsistent(dates: string[], expectedInterval: number): boolean {
  if (dates.length < 2) return false;

  const sortedDates = dates.map(d => new Date(d).getTime()).sort((a, b) => a - b);
  const intervals: number[] = [];

  for (let i = 1; i < sortedDates.length; i++) {
    intervals.push((sortedDates[i] - sortedDates[i - 1]) / (1000 * 60 * 60 * 24));
  }

  const stdDev = calculateStdDev(intervals);
  // Reject groups where standard deviation exceeds 30% of expected interval.
  return stdDev <= expectedInterval * 0.3;
}

/**
 * Detect recurring patterns in transactions for a workspace
 */
export function detectRecurringPatterns(workspaceId: number): {
  detected: number;
  patterns: DetectedPattern[]
} {
  const db = getDatabase();

  // Get all transactions for workspace
  const transactions = db
    .prepare(
      `
      SELECT t.id, t.description, t.amount, t.date, t.is_income
      FROM transactions t
      JOIN ledgers l ON t.ledger_id = l.id
      WHERE l.workspace_id = ?
      ORDER BY t.date ASC
    `
    )
    .all(workspaceId) as TransactionRow[];

  // Group by normalized description
  const groups: Map<string, TransactionGroup> = new Map();

  for (const tx of transactions) {
    const normalized = normalizeDescription(tx.description);
    if (!groups.has(normalized)) {
      groups.set(normalized, { normalizedDescription: normalized, transactions: [] });
    }
    groups.get(normalized)!.transactions.push(tx);
  }

  const detectedPatterns: DetectedPattern[] = [];

  // Analyze groups with 3+ transactions
  for (const [, group] of groups) {
    // Require at least 3 occurrences to establish a recurring pattern.
    if (group.transactions.length < 3) continue;

    // Separate by income/expense type
    const expenses = group.transactions.filter(t => t.is_income === 0);
    const incomes = group.transactions.filter(t => t.is_income === 1);

    // Analyze expenses
    if (expenses.length >= 3) {
      const pattern = analyzeGroup(expenses, group.normalizedDescription);
      if (pattern) {
        detectedPatterns.push(pattern);
      }
    }

    // Analyze incomes
    if (incomes.length >= 3) {
      const pattern = analyzeGroup(incomes, group.normalizedDescription);
      if (pattern) {
        detectedPatterns.push(pattern);
      }
    }
  }

  // Save patterns to database
  const insertPattern = db.prepare(
    `
    INSERT INTO recurring_patterns (workspace_id, description_pattern, frequency, avg_amount, occurrence_count)
    VALUES (?, ?, ?, ?, ?)
  `
  );

  const updateTransaction = db.prepare(
    `UPDATE transactions SET recurring_pattern_id = ? WHERE id = ?`
  );

  let detected = 0;

  const batchProcess = db.transaction(() => {
    for (const pattern of detectedPatterns) {
      // Check if pattern already exists
      const existing = db
        .prepare(
          `SELECT id FROM recurring_patterns
           WHERE workspace_id = ? AND description_pattern = ? AND frequency = ?`
        )
        .get(workspaceId, pattern.descriptionPattern, pattern.frequency) as { id: number } | undefined;

      let patternId: number;

      if (existing) {
        patternId = existing.id;
        // Update occurrence count
        db.prepare(
          `UPDATE recurring_patterns SET occurrence_count = ?, avg_amount = ? WHERE id = ?`
        ).run(pattern.transactionIds.length, pattern.avgAmount, patternId);
      } else {
        const result = insertPattern.run(
          workspaceId,
          pattern.descriptionPattern,
          pattern.frequency,
          pattern.avgAmount,
          pattern.transactionIds.length
        );
        patternId = Number(result.lastInsertRowid);
        detected++;
      }

      // Link transactions to pattern
      for (const txId of pattern.transactionIds) {
        updateTransaction.run(patternId, txId);
      }
    }
  });

  batchProcess();

  return { detected, patterns: detectedPatterns };
}

function analyzeGroup(transactions: TransactionRow[], normalizedDescription: string): DetectedPattern | null {
  const dates = transactions.map(t => t.date);
  const avgInterval = calculateAverageInterval(dates);
  const frequency = detectFrequency(avgInterval);

  if (!frequency) return null;

  // Verify interval consistency
  const expectedIntervals: Record<RecurringFrequency, number> = {
    weekly: 7,
    monthly: 30,
    yearly: 365,
  };

  if (!areIntervalsConsistent(dates, expectedIntervals[frequency])) {
    return null;
  }

  // Calculate average amount
  const avgAmount = Math.abs(
    transactions.reduce((sum, t) => sum + t.amount, 0) / transactions.length
  );

  return {
    descriptionPattern: normalizedDescription,
    frequency,
    avgAmount,
    transactionIds: transactions.map(t => t.id),
  };
}

/**
 * Get recurring patterns for a workspace
 */
export function getRecurringPatterns(workspaceId: number): Array<{
  id: number;
  descriptionPattern: string;
  frequency: string;
  avgAmount: number;
  occurrenceCount: number;
  isActive: boolean;
  createdAt: string;
}> {
  const db = getDatabase();

  const patterns = db
    .prepare(
      `
      SELECT id, description_pattern, frequency, avg_amount, occurrence_count, is_active, created_at
      FROM recurring_patterns
      WHERE workspace_id = ?
      ORDER BY occurrence_count DESC
    `
    )
    .all(workspaceId) as Array<{
      id: number;
      description_pattern: string;
      frequency: string;
      avg_amount: number;
      occurrence_count: number;
      is_active: number;
      created_at: string;
    }>;

  return patterns.map(p => ({
    id: p.id,
    descriptionPattern: p.description_pattern,
    frequency: p.frequency,
    avgAmount: p.avg_amount,
    occurrenceCount: p.occurrence_count,
    isActive: p.is_active === 1,
    createdAt: p.created_at,
  }));
}

/**
 * Toggle recurring pattern active status
 * Verifies the pattern belongs to a workspace owned by the user
 */
export function togglePatternActive(patternId: number, isActive: boolean, userId: number): boolean {
  const db = getDatabase();

  // Verify pattern belongs to a workspace the user is a member of
  const pattern = db
    .prepare(`
      SELECT rp.id
      FROM recurring_patterns rp
      JOIN workspace_members wm ON wm.workspace_id = rp.workspace_id
      WHERE rp.id = ? AND wm.user_id = ?
    `)
    .get(patternId, userId) as { id: number } | undefined;

  if (!pattern) {
    return false;
  }

  const result = db
    .prepare('UPDATE recurring_patterns SET is_active = ? WHERE id = ?')
    .run(isActive ? 1 : 0, patternId);

  return result.changes > 0;
}

/**
 * Delete a recurring pattern.
 * Verifies the pattern belongs to a workspace the user is a member of.
 * FK ON DELETE SET NULL clears recurring_pattern_id on linked transactions.
 */
export function deletePattern(patternId: number, userId: number): boolean {
  const db = getDatabase();

  const pattern = db
    .prepare(`
      SELECT rp.id
      FROM recurring_patterns rp
      JOIN workspace_members wm ON wm.workspace_id = rp.workspace_id
      WHERE rp.id = ? AND wm.user_id = ?
    `)
    .get(patternId, userId) as { id: number } | undefined;

  if (!pattern) {
    return false;
  }

  const result = db
    .prepare('DELETE FROM recurring_patterns WHERE id = ?')
    .run(patternId);

  return result.changes > 0;
}

/**
 * Get transactions linked to a recurring pattern.
 */
export function getPatternTransactions(patternId: number, workspaceId: number): TransactionWithCategory[] {
  const db = getDatabase();

  const pattern = db
    .prepare('SELECT id FROM recurring_patterns WHERE id = ? AND workspace_id = ?')
    .get(patternId, workspaceId) as { id: number } | undefined;

  if (!pattern) {
    throw AppError.notFound('Pattern not found');
  }

  const results = db
    .prepare(`
      SELECT
        t.id, t.ledger_id, t.date, t.description, t.amount, t.balance,
        t.category_id, t.is_income, t.raw_text, t.created_at, t.recurring_pattern_id,
        l.bank_id,
        c.id as cat_id, c.name as cat_name, c.color as cat_color,
        c.icon as cat_icon, c.is_default as cat_is_default, c.created_at as cat_created_at
      FROM transactions t
      JOIN ledgers l ON t.ledger_id = l.id
      LEFT JOIN categories c ON t.category_id = c.id
      WHERE t.recurring_pattern_id = ? AND l.workspace_id = ?
      ORDER BY t.date DESC
    `)
    .all(patternId, workspaceId) as Array<{
      id: number;
      ledger_id: number;
      date: string;
      description: string;
      amount: number;
      balance: number | null;
      category_id: number | null;
      is_income: number;
      raw_text: string | null;
      created_at: string;
      recurring_pattern_id: number | null;
      bank_id: string;
      cat_id: number | null;
      cat_name: string | null;
      cat_color: string | null;
      cat_icon: string | null;
      cat_is_default: number | null;
      cat_created_at: string | null;
    }>;

  return results.map(r => ({
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
  }));
}

/**
 * Update a recurring pattern.
 * Verifies the pattern belongs to a workspace the user is a member of.
 */
export interface UpdatePatternData {
  descriptionPattern?: string;
  frequency?: RecurringFrequency;
  avgAmount?: number;
  isActive?: boolean;
}

export function updatePattern(patternId: number, userId: number, data: UpdatePatternData): boolean {
  const db = getDatabase();

  const pattern = db
    .prepare(`
      SELECT rp.id
      FROM recurring_patterns rp
      JOIN workspace_members wm ON wm.workspace_id = rp.workspace_id
      WHERE rp.id = ? AND wm.user_id = ?
    `)
    .get(patternId, userId) as { id: number } | undefined;

  if (!pattern) {
    return false;
  }

  const updates: string[] = [];
  const params: unknown[] = [];

  if (data.descriptionPattern !== undefined) {
    updates.push('description_pattern = ?');
    params.push(data.descriptionPattern);
  }

  if (data.frequency !== undefined) {
    updates.push('frequency = ?');
    params.push(data.frequency);
  }

  if (data.avgAmount !== undefined) {
    updates.push('avg_amount = ?');
    params.push(data.avgAmount);
  }

  if (data.isActive !== undefined) {
    updates.push('is_active = ?');
    params.push(data.isActive ? 1 : 0);
  }

  if (updates.length === 0) {
    return true;
  }

  params.push(patternId);

  const result = db
    .prepare(`UPDATE recurring_patterns SET ${updates.join(', ')} WHERE id = ?`)
    .run(...params);

  return result.changes > 0;
}

/**
 * Get recurring summary for a workspace (active pattern count + estimated monthly cost).
 */
export function getRecurringSummary(workspaceId: number): RecurringSummary {
  const db = getDatabase();

  const result = db
    .prepare(`
      SELECT
        COUNT(*) as total_active,
        COALESCE(SUM(
          CASE frequency
            WHEN 'weekly' THEN avg_amount * 4.33
            WHEN 'monthly' THEN avg_amount
            WHEN 'yearly' THEN avg_amount / 12.0
          END
        ), 0) as estimated_monthly_cost
      FROM recurring_patterns
      WHERE workspace_id = ? AND is_active = 1
    `)
    .get(workspaceId) as {
      total_active: number;
      estimated_monthly_cost: number;
    };

  return {
    totalActive: result.total_active,
    estimatedMonthlyCost: result.estimated_monthly_cost,
  };
}
