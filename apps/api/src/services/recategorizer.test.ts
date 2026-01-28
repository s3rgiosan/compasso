import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../db/database.js', () => ({
  getDatabase: vi.fn(),
}));

vi.mock('./categoryMatcher.js', () => ({
  matchCategory: vi.fn(),
}));

import { getDatabase } from '../db/database.js';
import { matchCategory } from './categoryMatcher.js';
import { recategorizeByPattern } from './recategorizer.js';

describe('recategorizeByPattern', () => {
  const mockDb = {
    prepare: vi.fn(),
  };

  const mockRun = vi.fn();

  beforeEach(() => {
    vi.mocked(getDatabase).mockReturnValue(mockDb as any);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should recategorize matching uncategorized transactions', () => {
    const otherCategory = { id: 99 };
    const candidates = [
      { id: 1, description: 'PINGO DOCE LISBOA', bank_id: 'novo_banco' },
      { id: 2, description: 'CONTINENTE ALMADA', bank_id: 'novo_banco' },
      { id: 3, description: 'UNKNOWN MERCHANT', bank_id: 'novo_banco' },
    ];

    mockDb.prepare.mockImplementation((sql: string) => {
      if (sql.includes("name = 'Other'")) {
        return { get: vi.fn().mockReturnValue(otherCategory) };
      }
      if (sql.includes('SELECT t.id')) {
        return { all: vi.fn().mockReturnValue(candidates) };
      }
      if (sql.includes('UPDATE transactions')) {
        return { run: mockRun };
      }
      return { get: vi.fn(), all: vi.fn().mockReturnValue([]), run: vi.fn() };
    });

    // First two match the target category (5), third doesn't match
    vi.mocked(matchCategory)
      .mockReturnValueOnce({ categoryId: 5, categoryName: 'Groceries' })
      .mockReturnValueOnce({ categoryId: 5, categoryName: 'Groceries' })
      .mockReturnValueOnce(null);

    const result = recategorizeByPattern('novo_banco', 1, 5);

    expect(result.totalChecked).toBe(3);
    expect(result.recategorized).toBe(2);
    expect(mockRun).toHaveBeenCalledTimes(2);
    expect(mockRun).toHaveBeenCalledWith(5, 1);
    expect(mockRun).toHaveBeenCalledWith(5, 2);
  });

  it('should only update transactions matching the new category', () => {
    const otherCategory = { id: 99 };
    const candidates = [
      { id: 1, description: 'SOME TX', bank_id: 'novo_banco' },
    ];

    mockDb.prepare.mockImplementation((sql: string) => {
      if (sql.includes("name = 'Other'")) {
        return { get: vi.fn().mockReturnValue(otherCategory) };
      }
      if (sql.includes('SELECT t.id')) {
        return { all: vi.fn().mockReturnValue(candidates) };
      }
      if (sql.includes('UPDATE transactions')) {
        return { run: mockRun };
      }
      return { get: vi.fn(), all: vi.fn().mockReturnValue([]), run: vi.fn() };
    });

    // Match returns a different category than the target
    vi.mocked(matchCategory).mockReturnValueOnce({
      categoryId: 10,
      categoryName: 'Transport',
    });

    const result = recategorizeByPattern('novo_banco', 1, 5);

    expect(result.totalChecked).toBe(1);
    expect(result.recategorized).toBe(0);
    expect(mockRun).not.toHaveBeenCalled();
  });

  it('should handle no Other category gracefully', () => {
    const candidates = [
      { id: 1, description: 'TEST TX', bank_id: 'novo_banco' },
    ];

    mockDb.prepare.mockImplementation((sql: string) => {
      if (sql.includes("name = 'Other'")) {
        return { get: vi.fn().mockReturnValue(undefined) };
      }
      if (sql.includes('SELECT t.id')) {
        return { all: vi.fn().mockReturnValue(candidates) };
      }
      if (sql.includes('UPDATE transactions')) {
        return { run: mockRun };
      }
      return { get: vi.fn(), all: vi.fn().mockReturnValue([]), run: vi.fn() };
    });

    vi.mocked(matchCategory).mockReturnValueOnce({
      categoryId: 5,
      categoryName: 'Groceries',
    });

    const result = recategorizeByPattern('novo_banco', 1, 5);

    expect(result.totalChecked).toBe(1);
    expect(result.recategorized).toBe(1);
  });

  it('should handle no candidate transactions', () => {
    mockDb.prepare.mockImplementation((sql: string) => {
      if (sql.includes("name = 'Other'")) {
        return { get: vi.fn().mockReturnValue({ id: 99 }) };
      }
      if (sql.includes('SELECT t.id')) {
        return { all: vi.fn().mockReturnValue([]) };
      }
      if (sql.includes('UPDATE transactions')) {
        return { run: mockRun };
      }
      return { get: vi.fn(), all: vi.fn().mockReturnValue([]), run: vi.fn() };
    });

    const result = recategorizeByPattern('novo_banco', 1, 5);

    expect(result.totalChecked).toBe(0);
    expect(result.recategorized).toBe(0);
    expect(matchCategory).not.toHaveBeenCalled();
  });
});
