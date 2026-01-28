import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('./recategorizer.js', () => ({
  recategorizeByPattern: vi.fn().mockReturnValue({ totalChecked: 10, recategorized: 3 }),
}));

vi.mock('../db/database.js', () => ({ getDatabase: vi.fn() }));

import { getDatabase } from '../db/database.js';
import { AppError } from '../errors.js';
import {
  listCategories,
  getCategoryWithPatterns,
  checkPatternExists,
  createCategory,
  updateCategory,
  deleteCategory,
  createQuickPattern,
  createPattern,
  deletePattern,
} from './categoryService.js';

const mockDb = { prepare: vi.fn() };

beforeEach(() => {
  vi.mocked(getDatabase).mockReturnValue(mockDb as any);
});

afterEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// listCategories
// ---------------------------------------------------------------------------
describe('listCategories', () => {
  it('returns paginated categories with mapped fields', () => {
    const dbRows = [
      { id: 1, name: 'Food', color: '#ff0000', icon: 'utensils', is_default: 0, workspace_id: 1, created_at: '2024-01-01' },
      { id: 2, name: 'Transport', color: '#00ff00', icon: 'car', is_default: 0, workspace_id: 1, created_at: '2024-01-02' },
    ];

    const mockGet = vi.fn().mockReturnValue({ count: 5 });
    const mockAll = vi.fn().mockReturnValue(dbRows);

    mockDb.prepare.mockImplementation((sql: string) => {
      if (sql.includes('COUNT')) return { get: mockGet };
      return { all: mockAll };
    });

    const result = listCategories(1, 10, 0);

    expect(result.total).toBe(5);
    expect(result.limit).toBe(10);
    expect(result.offset).toBe(0);
    expect(result.items).toHaveLength(2);
    expect(result.items[0]).toMatchObject({
      id: 1,
      name: 'Food',
      color: '#ff0000',
      icon: 'utensils',
      isDefault: false,
      workspaceId: 1,
    });
    expect(result.items[1]).toMatchObject({
      id: 2,
      name: 'Transport',
      isDefault: false,
    });
    expect(mockGet).toHaveBeenCalledWith(1);
    expect(mockAll).toHaveBeenCalledWith(1, 10, 0);
  });
});

// ---------------------------------------------------------------------------
// getCategoryWithPatterns
// ---------------------------------------------------------------------------
describe('getCategoryWithPatterns', () => {
  it('returns category with mapped patterns', () => {
    const categoryRow = { id: 1, name: 'Food', color: '#ff0000', icon: 'utensils', is_default: 0, workspace_id: 1, created_at: '2024-01-01' };
    const patternRows = [
      { id: 10, category_id: 1, bank_id: 'novo_banco', pattern: 'GROCERIES', priority: 0, created_at: '2024-01-01' },
    ];

    const mockGet = vi.fn().mockReturnValue(categoryRow);
    const mockAll = vi.fn().mockReturnValue(patternRows);

    mockDb.prepare.mockImplementation((sql: string) => {
      if (sql.includes('SELECT id, name, color, icon, is_default, workspace_id, created_at FROM categories WHERE id = ? AND workspace_id = ?')) {
        return { get: mockGet };
      }
      return { all: mockAll };
    });

    const result = getCategoryWithPatterns(1, 1);

    expect(result).toMatchObject({
      id: 1,
      name: 'Food',
      isDefault: false,
      patterns: [
        {
          id: 10,
          categoryId: 1,
          bankId: 'novo_banco',
          pattern: 'GROCERIES',
          priority: 0,
        },
      ],
    });
    expect(mockGet).toHaveBeenCalledWith(1, 1);
  });

  it('returns patterns filtered by bankId', () => {
    const categoryRow = { id: 1, name: 'Food', color: '#ff0000', icon: 'utensils', is_default: 0, workspace_id: 1, created_at: '2024-01-01' };
    const patternRows = [
      { id: 10, category_id: 1, bank_id: 'novo_banco', pattern: 'GROCERIES', priority: 0, created_at: '2024-01-01' },
    ];

    const mockGet = vi.fn().mockReturnValue(categoryRow);
    const mockAll = vi.fn().mockReturnValue(patternRows);

    mockDb.prepare.mockImplementation((sql: string) => {
      if (sql.includes('SELECT id, name, color, icon, is_default, workspace_id, created_at FROM categories WHERE id = ? AND workspace_id = ?')) {
        return { get: mockGet };
      }
      return { all: mockAll };
    });

    const result = getCategoryWithPatterns(1, 1, 'novo_banco');

    expect(result.patterns).toHaveLength(1);
    expect(result.patterns[0].bankId).toBe('novo_banco');
  });

  it('throws not found when category does not exist', () => {
    const mockGet = vi.fn().mockReturnValue(undefined);

    mockDb.prepare.mockReturnValue({ get: mockGet });

    expect(() => getCategoryWithPatterns(999, 1)).toThrow(AppError);
    expect(() => getCategoryWithPatterns(999, 1)).toThrow('Category not found');
  });
});

// ---------------------------------------------------------------------------
// checkPatternExists
// ---------------------------------------------------------------------------
describe('checkPatternExists', () => {
  it('returns exists true when pattern is found', () => {
    const mockGet = vi.fn().mockReturnValue({ category_name: 'Food' });

    mockDb.prepare.mockReturnValue({ get: mockGet });

    const result = checkPatternExists(1, 'novo_banco', 'GROCERIES');

    expect(result).toEqual({ exists: true, categoryName: 'Food' });
  });

  it('returns exists false when pattern is not found', () => {
    const mockGet = vi.fn().mockReturnValue(undefined);

    mockDb.prepare.mockReturnValue({ get: mockGet });

    const result = checkPatternExists(1, 'novo_banco', 'NONEXISTENT');

    expect(result).toEqual({ exists: false, categoryName: undefined });
  });
});

// ---------------------------------------------------------------------------
// createCategory
// ---------------------------------------------------------------------------
describe('createCategory', () => {
  it('creates a category successfully', () => {
    const mockGet = vi.fn().mockReturnValue(undefined);
    const mockRun = vi.fn().mockReturnValue({ lastInsertRowid: 1 });

    mockDb.prepare.mockImplementation((sql: string) => {
      if (sql.includes('INSERT')) return { run: mockRun };
      if (sql.includes('SELECT') && sql.includes('name = ?')) return { get: mockGet };
      return { get: vi.fn() };
    });

    const result = createCategory({ name: 'Food', color: '#ff0000', icon: 'utensils', workspaceId: 1 });

    expect(result).toBeDefined();
    expect(result.name).toBe('Food');
    expect(result.isDefault).toBe(false);
  });

  it('throws when name is missing', () => {
    expect(() => createCategory({ name: '', workspaceId: 1 } as any)).toThrow('Category name is required');
  });

  it('throws when workspaceId is missing', () => {
    expect(() => createCategory({ name: 'Food', workspaceId: 0 } as any)).toThrow('workspaceId is required');
  });

  it('throws on duplicate category name', () => {
    const mockGet = vi.fn().mockReturnValue({ id: 1, name: 'Food' });

    mockDb.prepare.mockReturnValue({ get: mockGet });

    expect(() => createCategory({ name: 'Food', workspaceId: 1 })).toThrow(
      'Category name already exists in this workspace',
    );
  });
});

// ---------------------------------------------------------------------------
// updateCategory
// ---------------------------------------------------------------------------
describe('updateCategory', () => {
  it('updates a category successfully', () => {
    const mockGet = vi.fn().mockReturnValue(undefined);
    const mockRun = vi.fn().mockReturnValue({ changes: 1 });

    mockDb.prepare.mockImplementation((sql: string) => {
      if (sql.includes('SELECT')) return { get: mockGet };
      return { run: mockRun };
    });

    expect(() => updateCategory(1, 1, { name: 'Updated' })).not.toThrow();
  });

  it('throws not found when category does not exist', () => {
    const mockGet = vi.fn().mockReturnValue(undefined);
    const mockRun = vi.fn().mockReturnValue({ changes: 0 });

    mockDb.prepare.mockImplementation((sql: string) => {
      if (sql.includes('SELECT')) return { get: mockGet };
      return { run: mockRun };
    });

    expect(() => updateCategory(999, 1, { name: 'Updated' })).toThrow('Category not found');
  });

  it('throws on duplicate name', () => {
    const mockGet = vi.fn().mockReturnValue({ id: 2 });

    mockDb.prepare.mockReturnValue({ get: mockGet });

    expect(() => updateCategory(1, 1, { name: 'Duplicate' })).toThrow(
      'Category name already exists in this workspace',
    );
  });

  it('throws when no fields to update', () => {
    expect(() => updateCategory(1, 1, {})).toThrow('No fields to update');
  });

  it('updates color without duplicate name check', () => {
    const mockRun = vi.fn().mockReturnValue({ changes: 1 });

    mockDb.prepare.mockReturnValue({ run: mockRun });

    expect(() => updateCategory(1, 1, { color: '#ff0000' })).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// deleteCategory
// ---------------------------------------------------------------------------
describe('deleteCategory', () => {
  it('deletes a category successfully', () => {
    const mockGet = vi.fn().mockReturnValue({ id: 1, name: 'Food', is_default: 0 });
    const mockRun = vi.fn().mockReturnValue({ changes: 1 });

    mockDb.prepare.mockImplementation((sql: string) => {
      if (sql.includes('SELECT')) return { get: mockGet };
      return { run: mockRun };
    });

    expect(() => deleteCategory(1, 1)).not.toThrow();
  });

  it('deletes a default category successfully', () => {
    const mockGet = vi.fn().mockReturnValue({ id: 1, name: 'Uncategorized', is_default: 1 });
    const mockRun = vi.fn().mockReturnValue({ changes: 1 });

    mockDb.prepare.mockImplementation((sql: string) => {
      if (sql.includes('SELECT')) return { get: mockGet };
      return { run: mockRun };
    });

    expect(() => deleteCategory(1, 1)).not.toThrow();
  });

  it('throws not found when category does not exist', () => {
    const mockGet = vi.fn().mockReturnValue(undefined);

    mockDb.prepare.mockReturnValue({ get: mockGet });

    expect(() => deleteCategory(999, 1)).toThrow('Category not found');
  });
});

// ---------------------------------------------------------------------------
// createQuickPattern
// ---------------------------------------------------------------------------
describe('createQuickPattern', () => {
  it('creates a quick pattern successfully', () => {
    const category = { id: 1, name: 'Food', color: '#ff0000', icon: 'utensils', is_default: 0, workspace_id: 1, created_at: '2024-01-01' };

    const mockGet = vi.fn().mockReturnValue(category);
    const mockGetNull = vi.fn().mockReturnValue(undefined);
    const mockRun = vi.fn().mockReturnValue({ lastInsertRowid: 42 });

    mockDb.prepare.mockImplementation((sql: string) => {
      if (sql.includes('categories WHERE id = ?') && sql.includes('workspace_id = ?')) {
        return { get: mockGet };
      }
      if (sql.includes('category_patterns') && sql.includes('cp.pattern')) {
        return { get: mockGetNull };
      }
      if (sql.includes('INSERT')) return { run: mockRun };
      return { get: mockGetNull };
    });

    const result = createQuickPattern(1, 1, 'novo_banco', 'GROCERIES');

    expect(result).toBe(42);
  });

  it('throws on duplicate pattern', () => {
    const category = { id: 1, name: 'Food', color: '#ff0000', icon: 'utensils', is_default: 0, workspace_id: 1, created_at: '2024-01-01' };
    const existing = { id: 10, category_name: 'Food' };

    mockDb.prepare.mockImplementation((sql: string) => {
      if (sql.includes('categories WHERE id = ?') && sql.includes('workspace_id = ?')) {
        return { get: vi.fn().mockReturnValue(category) };
      }
      if (sql.includes('category_patterns') && sql.includes('cp.pattern')) {
        return { get: vi.fn().mockReturnValue(existing) };
      }
      return { get: vi.fn().mockReturnValue(undefined) };
    });

    expect(() => createQuickPattern(1, 1, 'novo_banco', 'GROCERIES')).toThrow(AppError);
  });

  it('throws on invalid bank id', () => {
    expect(() => createQuickPattern(1, 1, 'invalid_bank', 'GROCERIES')).toThrow(AppError);
  });
});

// ---------------------------------------------------------------------------
// createPattern
// ---------------------------------------------------------------------------
describe('createPattern', () => {
  it('creates a pattern and recategorizes transactions', () => {
    const category = { id: 1, name: 'Food', color: '#ff0000', icon: 'utensils', is_default: 0, workspace_id: 1, created_at: '2024-01-01' };

    const mockGet = vi.fn().mockReturnValue(category);
    const mockGetNull = vi.fn().mockReturnValue(undefined);
    const mockRun = vi.fn().mockReturnValue({ lastInsertRowid: 55 });

    mockDb.prepare.mockImplementation((sql: string) => {
      if (sql.includes('categories WHERE id = ?') && sql.includes('workspace_id = ?')) {
        return { get: mockGet };
      }
      if (sql.includes('category_patterns') && sql.includes('cp.pattern')) {
        return { get: mockGetNull };
      }
      if (sql.includes('INSERT')) return { run: mockRun };
      return { get: mockGetNull };
    });

    const result = createPattern(1, 1, 'novo_banco', 'GROCERIES', 1);

    expect(result).toEqual({ patternId: 55, recategorized: 3 });
  });

  it('throws on duplicate pattern', () => {
    const category = { id: 1, name: 'Food', color: '#ff0000', icon: 'utensils', is_default: 0, workspace_id: 1, created_at: '2024-01-01' };
    const existing = { id: 10, category_name: 'Food' };

    mockDb.prepare.mockImplementation((sql: string) => {
      if (sql.includes('categories WHERE id = ?') && sql.includes('workspace_id = ?')) {
        return { get: vi.fn().mockReturnValue(category) };
      }
      if (sql.includes('category_patterns') && sql.includes('cp.pattern')) {
        return { get: vi.fn().mockReturnValue(existing) };
      }
      return { get: vi.fn().mockReturnValue(undefined) };
    });

    expect(() => createPattern(1, 1, 'novo_banco', 'GROCERIES', 1)).toThrow(AppError);
  });
});

// ---------------------------------------------------------------------------
// deletePattern
// ---------------------------------------------------------------------------
describe('deletePattern', () => {
  it('deletes a pattern successfully', () => {
    const category = { id: 1, name: 'Food', color: '#ff0000', icon: 'utensils', is_default: 0, workspace_id: 1, created_at: '2024-01-01' };

    const mockGet = vi.fn().mockReturnValue(category);
    const mockRun = vi.fn().mockReturnValue({ changes: 1 });

    mockDb.prepare.mockImplementation((sql: string) => {
      if (sql.includes('categories WHERE id = ?') && sql.includes('workspace_id = ?')) {
        return { get: mockGet };
      }
      return { run: mockRun };
    });

    expect(() => deletePattern(1, 10, 1)).not.toThrow();
  });

  it('throws not found when pattern does not exist', () => {
    const category = { id: 1, name: 'Food', color: '#ff0000', icon: 'utensils', is_default: 0, workspace_id: 1, created_at: '2024-01-01' };

    const mockGet = vi.fn().mockReturnValue(category);
    const mockRun = vi.fn().mockReturnValue({ changes: 0 });

    mockDb.prepare.mockImplementation((sql: string) => {
      if (sql.includes('categories WHERE id = ?') && sql.includes('workspace_id = ?')) {
        return { get: mockGet };
      }
      return { run: mockRun };
    });

    expect(() => deletePattern(1, 999, 1)).toThrow('Pattern not found');
  });
});
