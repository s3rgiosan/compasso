import { getDatabase } from '../db/database.js';
import { recategorizeByPattern } from './recategorizer.js';
import { clearPatternCache } from './categoryMatcher.js';
import { AppError } from '../errors.js';
import {
  ErrorCode,
  type Category,
  type CategoryWithPatterns,
} from '@compasso/shared';
import { SUPPORTED_BANKS } from '../parsers/registry.js';

interface CategoryRow {
  id: number;
  name: string;
  color: string | null;
  icon: string | null;
  is_default: number;
  workspace_id: number;
  created_at: string;
}

interface PatternRow {
  id: number;
  category_id: number;
  bank_id: string;
  pattern: string;
  priority: number;
  created_at: string;
}

interface CategoryListResult {
  items: Category[];
  total: number;
  limit: number;
  offset: number;
}

function verifyCategoryOwnership(categoryId: number, workspaceId: number): CategoryRow {
  const db = getDatabase();
  const category = db
    .prepare('SELECT id, name, color, icon, is_default, workspace_id, created_at FROM categories WHERE id = ? AND workspace_id = ?')
    .get(categoryId, workspaceId) as CategoryRow | undefined;

  if (!category) {
    throw AppError.notFound('Category not found');
  }

  return category;
}

function assertPatternNotDuplicate(
  workspaceId: number,
  bankId: string,
  pattern: string
): void {
  const db = getDatabase();
  const existingPattern = db
    .prepare(
      `
      SELECT cp.id, c.name as category_name
      FROM category_patterns cp
      JOIN categories c ON cp.category_id = c.id
      WHERE cp.pattern = ? AND cp.bank_id = ? AND c.workspace_id = ?
      LIMIT 1
    `
    )
    .get(pattern, bankId, workspaceId) as { id: number; category_name: string } | undefined;

  if (existingPattern) {
    throw AppError.badRequest(
      `This pattern already exists in category "${existingPattern.category_name}"`,
      ErrorCode.DUPLICATE_RESOURCE
    );
  }
}

/**
 * List categories for a workspace with pagination.
 */
export function listCategories(workspaceId: number, limit: number, offset: number): CategoryListResult {
  const db = getDatabase();

  const countResult = db
    .prepare('SELECT COUNT(*) as count FROM categories WHERE workspace_id = ?')
    .get(workspaceId) as { count: number };

  const categories = db
    .prepare(
      `
      SELECT id, name, color, icon, is_default, workspace_id, created_at
      FROM categories
      WHERE workspace_id = ?
      ORDER BY is_default DESC, name ASC
      LIMIT ? OFFSET ?
    `
    )
    .all(workspaceId, limit, offset) as CategoryRow[];

  const items: Category[] = categories.map((c) => ({
    id: c.id,
    name: c.name,
    color: c.color,
    icon: c.icon,
    isDefault: c.is_default === 1,
    createdAt: c.created_at,
    workspaceId: c.workspace_id,
  }));

  return { items, total: countResult.count, limit, offset };
}

/**
 * Get a single category with its patterns, optionally filtered by bank.
 */
export function getCategoryWithPatterns(
  categoryId: number,
  workspaceId: number,
  bankId?: string
): CategoryWithPatterns {
  const category = verifyCategoryOwnership(categoryId, workspaceId);

  const db = getDatabase();
  let patternsQuery = `
    SELECT id, category_id, bank_id, pattern, priority, created_at
    FROM category_patterns
    WHERE category_id = ?
  `;
  const params: unknown[] = [categoryId];

  if (bankId) {
    patternsQuery += ' AND bank_id = ?';
    params.push(bankId);
  }

  patternsQuery += ' ORDER BY bank_id, priority DESC, id ASC';

  const patterns = db.prepare(patternsQuery).all(...params) as PatternRow[];

  return {
    id: category.id,
    name: category.name,
    color: category.color,
    icon: category.icon,
    isDefault: category.is_default === 1,
    createdAt: category.created_at,
    patterns: patterns.map((p) => ({
      id: p.id,
      categoryId: p.category_id,
      bankId: p.bank_id,
      pattern: p.pattern,
      priority: p.priority,
      createdAt: p.created_at,
    })),
  };
}

/**
 * Check whether a pattern already exists in a workspace for a given bank.
 */
export function checkPatternExists(
  workspaceId: number,
  bankId: string,
  pattern: string
): { exists: boolean; categoryName?: string } {
  const db = getDatabase();
  const existingPattern = db
    .prepare(
      `
      SELECT c.name as category_name
      FROM category_patterns cp
      JOIN categories c ON cp.category_id = c.id
      WHERE cp.pattern = ? AND cp.bank_id = ? AND c.workspace_id = ?
      LIMIT 1
    `
    )
    .get(pattern, bankId, workspaceId) as { category_name: string } | undefined;

  return {
    exists: !!existingPattern,
    categoryName: existingPattern?.category_name,
  };
}

/**
 * Create a new category in a workspace.
 */
export function createCategory(data: {
  name: string;
  color?: string;
  icon?: string;
  workspaceId: number;
}): Category {
  if (!data.name) {
    throw AppError.badRequest('Category name is required');
  }

  if (!data.workspaceId) {
    throw AppError.badRequest('workspaceId is required');
  }

  const db = getDatabase();

  const existing = db
    .prepare('SELECT id FROM categories WHERE name = ? AND workspace_id = ?')
    .get(data.name, data.workspaceId);

  if (existing) {
    throw AppError.badRequest(
      'Category name already exists in this workspace',
      ErrorCode.DUPLICATE_RESOURCE
    );
  }

  const result = db
    .prepare(
      'INSERT INTO categories (name, color, icon, is_default, workspace_id) VALUES (?, ?, ?, 0, ?)'
    )
    .run(data.name, data.color || null, data.icon || null, data.workspaceId);

  const categoryId = Number(result.lastInsertRowid);

  return {
    id: categoryId,
    name: data.name,
    color: data.color || null,
    icon: data.icon || null,
    isDefault: false,
    createdAt: new Date().toISOString(),
    workspaceId: data.workspaceId,
  };
}

/**
 * Update a category's name, color, or icon.
 */
export function updateCategory(
  categoryId: number,
  workspaceId: number,
  data: { name?: string; color?: string; icon?: string }
): void {
  const updates: string[] = [];
  const params: unknown[] = [];

  if (data.name !== undefined) {
    updates.push('name = ?');
    params.push(data.name);
  }

  if (data.color !== undefined) {
    updates.push('color = ?');
    params.push(data.color);
  }

  if (data.icon !== undefined) {
    updates.push('icon = ?');
    params.push(data.icon);
  }

  if (updates.length === 0) {
    throw AppError.badRequest('No fields to update');
  }

  const db = getDatabase();

  // Check for duplicate name within the workspace
  if (data.name !== undefined) {
    const existing = db
      .prepare('SELECT id FROM categories WHERE name = ? AND workspace_id = ? AND id != ?')
      .get(data.name, workspaceId, categoryId);

    if (existing) {
      throw AppError.badRequest(
        'Category name already exists in this workspace',
        ErrorCode.DUPLICATE_RESOURCE
      );
    }
  }

  params.push(categoryId);
  params.push(workspaceId);

  const result = db
    .prepare(`UPDATE categories SET ${updates.join(', ')} WHERE id = ? AND workspace_id = ?`)
    .run(...params);

  if (result.changes === 0) {
    throw AppError.notFound('Category not found');
  }
}

/**
 * Delete a category.
 */
export function deleteCategory(categoryId: number, workspaceId: number): void {
  const db = getDatabase();

  const category = db
    .prepare('SELECT id FROM categories WHERE id = ? AND workspace_id = ?')
    .get(categoryId, workspaceId) as { id: number } | undefined;

  if (!category) {
    throw AppError.notFound('Category not found');
  }

  db.prepare('DELETE FROM categories WHERE id = ? AND workspace_id = ?').run(categoryId, workspaceId);
}

/**
 * Create a pattern without recategorizing existing transactions (used in upload flow).
 */
export function createQuickPattern(
  categoryId: number,
  workspaceId: number,
  bankId: string,
  pattern: string
): number {
  if (!workspaceId) {
    throw AppError.badRequest('workspaceId is required');
  }

  if (!bankId) {
    throw AppError.badRequest('bankId is required');
  }

  if (!pattern) {
    throw AppError.badRequest('pattern is required');
  }

  const validBankIds = Object.values(SUPPORTED_BANKS);
  if (!validBankIds.includes(bankId)) {
    throw AppError.badRequest('Invalid bank ID');
  }

  verifyCategoryOwnership(categoryId, workspaceId);
  assertPatternNotDuplicate(workspaceId, bankId, pattern);

  const db = getDatabase();
  const result = db
    .prepare(
      'INSERT INTO category_patterns (category_id, bank_id, pattern, priority) VALUES (?, ?, ?, 0)'
    )
    .run(categoryId, bankId, pattern);

  clearPatternCache();
  return Number(result.lastInsertRowid);
}

/**
 * Create a pattern and recategorize existing transactions that match.
 */
export function createPattern(
  categoryId: number,
  workspaceId: number,
  bankId: string,
  pattern: string,
  priority: number
): { patternId: number; recategorized: number } {
  if (!workspaceId) {
    throw AppError.badRequest('workspaceId is required');
  }

  if (!bankId) {
    throw AppError.badRequest('Bank ID is required');
  }

  if (!pattern) {
    throw AppError.badRequest('Pattern is required');
  }

  verifyCategoryOwnership(categoryId, workspaceId);
  assertPatternNotDuplicate(workspaceId, bankId, pattern);

  const db = getDatabase();
  const result = db
    .prepare(
      'INSERT INTO category_patterns (category_id, bank_id, pattern, priority) VALUES (?, ?, ?, ?)'
    )
    .run(categoryId, bankId, pattern, priority);

  clearPatternCache();

  const recategorizeResult = recategorizeByPattern(
    bankId,
    workspaceId,
    categoryId
  );

  return {
    patternId: Number(result.lastInsertRowid),
    recategorized: recategorizeResult.recategorized,
  };
}

/**
 * Delete a pattern from a category.
 */
export function deletePattern(categoryId: number, patternId: number, workspaceId: number): void {
  verifyCategoryOwnership(categoryId, workspaceId);

  const db = getDatabase();
  const result = db
    .prepare('DELETE FROM category_patterns WHERE id = ? AND category_id = ?')
    .run(patternId, categoryId);

  clearPatternCache();

  if (result.changes === 0) {
    throw AppError.notFound('Pattern not found');
  }
}
