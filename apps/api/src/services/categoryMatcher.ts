import { getDatabase } from '../db/database.js';
import type { ParsedTransaction, BankId } from '@compasso/shared';

interface PatternWithPriority {
  id: number;
  categoryId: number;
  categoryName: string;
  pattern: string;
  priority: number;
}

interface CategoryScore {
  categoryId: number;
  categoryName: string;
  score: number;
  excluded: boolean;
}

// Escape special regex characters in a string
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Simple TTL cache for patterns to avoid repeated DB queries during batch operations
let patternCache: { key: string; patterns: PatternWithPriority[]; timestamp: number } | null = null;

export function clearPatternCache(): void {
  patternCache = null;
}

// Get all patterns for a specific bank and workspace, sorted by priority (highest first)
function getPatternsWithPriority(bankId: BankId, workspaceId: number): PatternWithPriority[] {
  const key = `${bankId}:${workspaceId}`;
  const now = Date.now();
  if (patternCache && patternCache.key === key && now - patternCache.timestamp < 5000) {
    return patternCache.patterns;
  }

  const db = getDatabase();

  const patterns = db
    .prepare(
      `
      SELECT cp.id, cp.category_id, c.name as category_name, cp.pattern, cp.priority
      FROM category_patterns cp
      JOIN categories c ON c.id = cp.category_id
      WHERE cp.bank_id = ? AND c.workspace_id = ?
      ORDER BY cp.priority DESC, cp.id ASC
    `
    )
    .all(bankId, workspaceId) as Array<{
    id: number;
    category_id: number;
    category_name: string;
    pattern: string;
    priority: number;
  }>;

  const result = patterns.map((p) => ({
    id: p.id,
    categoryId: p.category_id,
    categoryName: p.category_name,
    pattern: p.pattern,
    priority: p.priority,
  }));

  patternCache = { key, patterns: result, timestamp: now };
  return result;
}

// Check if a pattern matches the description
function matchesPattern(description: string, pattern: string, useWordBoundary: boolean): boolean {
  try {
    if (useWordBoundary) {
      // Use word boundary matching for regular patterns
      const wordBoundaryRegex = new RegExp(`\\b${escapeRegex(pattern)}\\b`, 'i');
      return wordBoundaryRegex.test(description);
    } else {
      // Simple case-insensitive substring match (fallback)
      return description.toLowerCase().includes(pattern.toLowerCase());
    }
  } catch {
    // If regex fails, fall back to simple includes
    return description.toLowerCase().includes(pattern.toLowerCase());
  }
}

/**
 * Matches a transaction description against category patterns for a given bank/workspace.
 *
 * Three pattern types are supported:
 * - Plain text — case-insensitive word-boundary match (e.g. "LIDL")
 * - `!` prefix — exclusion, prevents a category from matching (e.g. "!REFUND")
 * - `regex:` prefix — full regex match (e.g. "regex:UBER\\s*(EATS|TRIP)")
 *
 * When multiple categories match, the highest cumulative priority score wins.
 */
export function matchCategory(
  description: string,
  bankId: BankId,
  workspaceId: number
): { categoryId: number; categoryName: string } | null {
  const patterns = getPatternsWithPriority(bankId, workspaceId);
  const categoryScores = new Map<number, CategoryScore>();

  for (const pattern of patterns) {
    const patternText = pattern.pattern.trim();

    // Handle exclusion patterns (prefixed with !)
    if (patternText.startsWith('!')) {
      const excludePattern = patternText.slice(1);
      let matches = false;

      // Check if it's a regex exclusion pattern
      if (excludePattern.startsWith('regex:')) {
        try {
          const regex = new RegExp(excludePattern.slice(6), 'i');
          matches = regex.test(description);
        } catch {
          // Invalid regex, skip
          continue;
        }
      } else {
        // Word boundary matching for exclusion
        matches = matchesPattern(description, excludePattern, true);
      }

      if (matches) {
        // Mark this category as excluded
        const existing = categoryScores.get(pattern.categoryId);
        if (existing) {
          existing.excluded = true;
        } else {
          categoryScores.set(pattern.categoryId, {
            categoryId: pattern.categoryId,
            categoryName: pattern.categoryName,
            score: 0,
            excluded: true,
          });
        }
      }
      continue;
    }

    // Handle regex patterns (prefixed with regex:)
    if (patternText.startsWith('regex:')) {
      try {
        const regex = new RegExp(patternText.slice(6), 'i');
        if (regex.test(description)) {
          const existing = categoryScores.get(pattern.categoryId);
          if (existing && !existing.excluded) {
            existing.score += pattern.priority + 1; // +1 to ensure score > 0 even for priority 0
          } else if (!existing) {
            categoryScores.set(pattern.categoryId, {
              categoryId: pattern.categoryId,
              categoryName: pattern.categoryName,
              score: pattern.priority + 1,
              excluded: false,
            });
          }
        }
      } catch {
        // Invalid regex, skip this pattern
        continue;
      }
      continue;
    }

    // Standard pattern matching with word boundaries
    if (matchesPattern(description, patternText, true)) {
      const existing = categoryScores.get(pattern.categoryId);
      if (existing && !existing.excluded) {
        existing.score += pattern.priority + 1;
      } else if (!existing) {
        categoryScores.set(pattern.categoryId, {
          categoryId: pattern.categoryId,
          categoryName: pattern.categoryName,
          score: pattern.priority + 1,
          excluded: false,
        });
      }
    }
  }

  // Find the category with the highest score that isn't excluded
  let bestMatch: CategoryScore | null = null;

  for (const score of categoryScores.values()) {
    if (score.excluded || score.score <= 0) continue;

    if (!bestMatch || score.score > bestMatch.score) {
      bestMatch = score;
    }
  }

  if (bestMatch) {
    return {
      categoryId: bestMatch.categoryId,
      categoryName: bestMatch.categoryName,
    };
  }

  return null;
}

// Apply category suggestions to parsed transactions for a specific bank and workspace
export function applyCategorySuggestions(
  transactions: ParsedTransaction[],
  bankId: BankId,
  workspaceId: number
): ParsedTransaction[] {
  const db = getDatabase();

  // Get the "Income" category for credit transactions (from this workspace)
  const incomeCategory = db
    .prepare("SELECT id, name FROM categories WHERE name = 'Income' AND workspace_id = ?")
    .get(workspaceId) as { id: number; name: string } | undefined;

  // Get the "Other" category as fallback (from this workspace)
  const otherCategory = db
    .prepare("SELECT id, name FROM categories WHERE name = 'Other' AND workspace_id = ?")
    .get(workspaceId) as { id: number; name: string } | undefined;

  return transactions.map((tx) => {
    // For income transactions, suggest Income category
    if (tx.isIncome && incomeCategory) {
      return {
        ...tx,
        suggestedCategoryId: incomeCategory.id,
        suggestedCategoryName: incomeCategory.name,
      };
    }

    // Try to match by description using bank-specific patterns
    const match = matchCategory(tx.description, bankId, workspaceId);
    if (match) {
      return {
        ...tx,
        suggestedCategoryId: match.categoryId,
        suggestedCategoryName: match.categoryName,
      };
    }

    // Fall back to "Other" if available
    if (otherCategory) {
      return {
        ...tx,
        suggestedCategoryId: otherCategory.id,
        suggestedCategoryName: otherCategory.name,
      };
    }

    return tx;
  });
}
