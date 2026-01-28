import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { ParsedTransaction } from '@compasso/shared';

// Mock the database module
vi.mock('../db/database.js', () => ({
  getDatabase: vi.fn(),
}));

import { getDatabase } from '../db/database.js';
import { matchCategory, applyCategorySuggestions, clearPatternCache } from './categoryMatcher.js';

const DEFAULT_WORKSPACE_ID = 1;

describe('categoryMatcher', () => {
  const mockDb = {
    prepare: vi.fn(),
  };

  beforeEach(() => {
    clearPatternCache();
    vi.mocked(getDatabase).mockReturnValue(mockDb as any);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('matchCategory', () => {
    it('should return matching category when pattern is found', () => {
      const mockPatterns = [
        { id: 1, category_id: 1, category_name: 'Groceries', pattern: 'pingo doce', priority: 0 },
        { id: 2, category_id: 1, category_name: 'Groceries', pattern: 'continente', priority: 0 },
        { id: 3, category_id: 2, category_name: 'Transport', pattern: 'uber', priority: 0 },
      ];

      mockDb.prepare.mockReturnValue({
        all: vi.fn().mockReturnValue(mockPatterns),
      });

      const result = matchCategory('PAGAMENTO PINGO DOCE LISBOA', 'novo_banco', DEFAULT_WORKSPACE_ID);

      expect(result).toEqual({
        categoryId: 1,
        categoryName: 'Groceries',
      });
    });

    it('should be case-insensitive when matching patterns', () => {
      const mockPatterns = [
        { id: 1, category_id: 1, category_name: 'Groceries', pattern: 'PINGO DOCE', priority: 0 },
      ];

      mockDb.prepare.mockReturnValue({
        all: vi.fn().mockReturnValue(mockPatterns),
      });

      const result = matchCategory('pagamento pingo doce lisboa', 'novo_banco', DEFAULT_WORKSPACE_ID);

      expect(result).toEqual({
        categoryId: 1,
        categoryName: 'Groceries',
      });
    });

    it('should return null when no pattern matches', () => {
      const mockPatterns = [
        { id: 1, category_id: 1, category_name: 'Groceries', pattern: 'pingo doce', priority: 0 },
      ];

      mockDb.prepare.mockReturnValue({
        all: vi.fn().mockReturnValue(mockPatterns),
      });

      const result = matchCategory('UNKNOWN MERCHANT XYZ', 'novo_banco', DEFAULT_WORKSPACE_ID);

      expect(result).toBeNull();
    });

    it('should return null when no patterns exist', () => {
      mockDb.prepare.mockReturnValue({
        all: vi.fn().mockReturnValue([]),
      });

      const result = matchCategory('PINGO DOCE', 'novo_banco', DEFAULT_WORKSPACE_ID);

      expect(result).toBeNull();
    });

    it('should use word boundary matching - should NOT match partial words', () => {
      const mockPatterns = [
        { id: 1, category_id: 1, category_name: 'Bank', pattern: 'BP', priority: 0 },
      ];

      mockDb.prepare.mockReturnValue({
        all: vi.fn().mockReturnValue(mockPatterns),
      });

      // "BPI" should NOT match pattern "BP"
      const result = matchCategory('TRANSFERENCIA BPI CONTA', 'novo_banco', DEFAULT_WORKSPACE_ID);

      expect(result).toBeNull();
    });

    it('should use word boundary matching - should match whole words', () => {
      const mockPatterns = [
        { id: 1, category_id: 1, category_name: 'Fuel', pattern: 'BP', priority: 0 },
      ];

      mockDb.prepare.mockReturnValue({
        all: vi.fn().mockReturnValue(mockPatterns),
      });

      // "BP" as a standalone word should match
      const result = matchCategory('BP GASOLINEIRA NORTE', 'novo_banco', DEFAULT_WORKSPACE_ID);

      expect(result).toEqual({
        categoryId: 1,
        categoryName: 'Fuel',
      });
    });

    it('should match category with highest cumulative score when multiple patterns match', () => {
      const mockPatterns = [
        { id: 1, category_id: 1, category_name: 'Fast Food', pattern: 'mcdonald', priority: 5 },
        { id: 2, category_id: 2, category_name: 'Restaurants', pattern: 'mcdonald', priority: 1 },
        { id: 3, category_id: 2, category_name: 'Restaurants', pattern: 'food', priority: 1 },
      ];

      mockDb.prepare.mockReturnValue({
        all: vi.fn().mockReturnValue(mockPatterns),
      });

      // "Fast Food" has score 6 (5+1), "Restaurants" has score 2 (1+1) for mcdonald only
      // (food doesn't match "MCDONALD AEROPORTO" with word boundary)
      const result = matchCategory('MCDONALD AEROPORTO', 'novo_banco', DEFAULT_WORKSPACE_ID);

      expect(result).toEqual({
        categoryId: 1,
        categoryName: 'Fast Food',
      });
    });

    it('should prefer higher priority patterns when same category', () => {
      const mockPatterns = [
        { id: 1, category_id: 1, category_name: 'Groceries', pattern: 'pingo doce', priority: 10 },
        { id: 2, category_id: 1, category_name: 'Groceries', pattern: 'doce', priority: 1 },
      ];

      mockDb.prepare.mockReturnValue({
        all: vi.fn().mockReturnValue(mockPatterns),
      });

      const result = matchCategory('PINGO DOCE ARMAZEN', 'novo_banco', DEFAULT_WORKSPACE_ID);

      // Both patterns match, scores add up: 11 + 2 = 13
      expect(result).toEqual({
        categoryId: 1,
        categoryName: 'Groceries',
      });
    });

    it('should support regex patterns', () => {
      const mockPatterns = [
        { id: 1, category_id: 1, category_name: 'Bank Transfer', pattern: 'regex:TRANS.*SEPA', priority: 0 },
      ];

      mockDb.prepare.mockReturnValue({
        all: vi.fn().mockReturnValue(mockPatterns),
      });

      const result = matchCategory('TRANSFERENCIA SEPA JOHN DOE', 'novo_banco', DEFAULT_WORKSPACE_ID);

      expect(result).toEqual({
        categoryId: 1,
        categoryName: 'Bank Transfer',
      });
    });

    it('should handle invalid regex patterns gracefully', () => {
      const mockPatterns = [
        { id: 1, category_id: 1, category_name: 'Test', pattern: 'regex:[invalid', priority: 0 },
        { id: 2, category_id: 2, category_name: 'Fallback', pattern: 'fallback', priority: 0 },
      ];

      mockDb.prepare.mockReturnValue({
        all: vi.fn().mockReturnValue(mockPatterns),
      });

      // Invalid regex should be skipped, should match fallback
      const result = matchCategory('fallback test', 'novo_banco', DEFAULT_WORKSPACE_ID);

      expect(result).toEqual({
        categoryId: 2,
        categoryName: 'Fallback',
      });
    });

    it('should support exclusion patterns', () => {
      const mockPatterns = [
        { id: 1, category_id: 1, category_name: 'Fuel', pattern: 'BP', priority: 0 },
        { id: 2, category_id: 1, category_name: 'Fuel', pattern: '!BPI', priority: 0 },
      ];

      mockDb.prepare.mockReturnValue({
        all: vi.fn().mockReturnValue(mockPatterns),
      });

      // Even though "BP" matches as a word boundary in "BPI", the exclusion "!BPI" should exclude this category
      // Actually wait - with word boundary matching, "BP" won't match "BPI" anyway
      // Let me create a better test case
      const result = matchCategory('BP BPI STATION', 'novo_banco', DEFAULT_WORKSPACE_ID);

      // "BP" as standalone word matches, but "BPI" exclusion also matches
      // Category should be excluded
      expect(result).toBeNull();
    });

    it('should allow category when exclusion pattern does not match', () => {
      const mockPatterns = [
        { id: 1, category_id: 1, category_name: 'Fuel', pattern: 'GALP', priority: 0 },
        { id: 2, category_id: 1, category_name: 'Fuel', pattern: '!BPI', priority: 0 },
      ];

      mockDb.prepare.mockReturnValue({
        all: vi.fn().mockReturnValue(mockPatterns),
      });

      // "GALP" matches, "BPI" exclusion does not match
      const result = matchCategory('GALP STATION NORTE', 'novo_banco', DEFAULT_WORKSPACE_ID);

      expect(result).toEqual({
        categoryId: 1,
        categoryName: 'Fuel',
      });
    });

    it('should support regex exclusion patterns', () => {
      const mockPatterns = [
        { id: 1, category_id: 1, category_name: 'Groceries', pattern: 'mercado', priority: 0 },
        { id: 2, category_id: 1, category_name: 'Groceries', pattern: '!regex:mercado.*livre', priority: 0 },
      ];

      mockDb.prepare.mockReturnValue({
        all: vi.fn().mockReturnValue(mockPatterns),
      });

      // "mercado livre" should be excluded but "mercado local" should match
      const result1 = matchCategory('MERCADO LIVRE ONLINE', 'novo_banco', DEFAULT_WORKSPACE_ID);
      expect(result1).toBeNull();
    });

    it('should match mercado when not followed by livre', () => {
      const mockPatterns = [
        { id: 1, category_id: 1, category_name: 'Groceries', pattern: 'mercado', priority: 0 },
        { id: 2, category_id: 1, category_name: 'Groceries', pattern: '!regex:mercado.*livre', priority: 0 },
      ];

      mockDb.prepare.mockReturnValue({
        all: vi.fn().mockReturnValue(mockPatterns),
      });

      const result = matchCategory('MERCADO LOCAL FRUTAS', 'novo_banco', DEFAULT_WORKSPACE_ID);

      expect(result).toEqual({
        categoryId: 1,
        categoryName: 'Groceries',
      });
    });

    it('should use bank-specific and workspace-specific patterns', () => {
      mockDb.prepare.mockReturnValue({
        all: vi.fn().mockReturnValue([]),
      });

      matchCategory('test', 'novo_banco', DEFAULT_WORKSPACE_ID);

      // Verify the bank_id and workspace_id parameters were passed
      expect(mockDb.prepare).toHaveBeenCalled();
      const prepareCall = mockDb.prepare.mock.calls[0][0];
      expect(prepareCall).toContain('bank_id');
      expect(prepareCall).toContain('workspace_id');
    });
  });

  describe('applyCategorySuggestions', () => {
    const createMockTransaction = (
      overrides: Partial<ParsedTransaction> = {}
    ): ParsedTransaction => ({
      date: '2024-11-15',
      valueDate: '2024-11-15',
      description: 'Test Transaction',
      amount: 100,
      balance: 1000,
      isIncome: false,
      rawText: 'Test',
      suggestedCategoryId: null,
      suggestedCategoryName: null,
      ...overrides,
    });

    it('should suggest Income category for income transactions', () => {
      const mockPatterns: any[] = [];
      const incomeCategory = { id: 10, name: 'Income' };
      const otherCategory = { id: 99, name: 'Other' };

      mockDb.prepare.mockImplementation((sql: string) => {
        if (sql.includes("name = 'Income'")) {
          return { get: vi.fn().mockReturnValue(incomeCategory) };
        }
        if (sql.includes("name = 'Other'")) {
          return { get: vi.fn().mockReturnValue(otherCategory) };
        }
        return { all: vi.fn().mockReturnValue(mockPatterns) };
      });

      const transactions = [createMockTransaction({ isIncome: true })];
      const result = applyCategorySuggestions(transactions, 'novo_banco', DEFAULT_WORKSPACE_ID);

      expect(result[0].suggestedCategoryId).toBe(10);
      expect(result[0].suggestedCategoryName).toBe('Income');
    });

    it('should match category by description for expense transactions', () => {
      const mockPatterns = [
        { id: 1, category_id: 1, category_name: 'Groceries', pattern: 'pingo doce', priority: 0 },
      ];
      const otherCategory = { id: 99, name: 'Other' };

      mockDb.prepare.mockImplementation((sql: string) => {
        if (sql.includes("name = 'Income'")) {
          return { get: vi.fn().mockReturnValue(undefined) };
        }
        if (sql.includes("name = 'Other'")) {
          return { get: vi.fn().mockReturnValue(otherCategory) };
        }
        return { all: vi.fn().mockReturnValue(mockPatterns) };
      });

      const transactions = [
        createMockTransaction({
          description: 'PAGAMENTO PINGO DOCE',
          isIncome: false,
        }),
      ];
      const result = applyCategorySuggestions(transactions, 'novo_banco', DEFAULT_WORKSPACE_ID);

      expect(result[0].suggestedCategoryId).toBe(1);
      expect(result[0].suggestedCategoryName).toBe('Groceries');
    });

    it('should fallback to Other category when no match', () => {
      const mockPatterns = [
        { id: 1, category_id: 1, category_name: 'Groceries', pattern: 'pingo doce', priority: 0 },
      ];
      const otherCategory = { id: 99, name: 'Other' };

      mockDb.prepare.mockImplementation((sql: string) => {
        if (sql.includes("name = 'Income'")) {
          return { get: vi.fn().mockReturnValue(undefined) };
        }
        if (sql.includes("name = 'Other'")) {
          return { get: vi.fn().mockReturnValue(otherCategory) };
        }
        return { all: vi.fn().mockReturnValue(mockPatterns) };
      });

      const transactions = [
        createMockTransaction({
          description: 'UNKNOWN MERCHANT',
          isIncome: false,
        }),
      ];
      const result = applyCategorySuggestions(transactions, 'novo_banco', DEFAULT_WORKSPACE_ID);

      expect(result[0].suggestedCategoryId).toBe(99);
      expect(result[0].suggestedCategoryName).toBe('Other');
    });

    it('should not modify transaction when no categories available', () => {
      mockDb.prepare.mockImplementation(() => ({
        get: vi.fn().mockReturnValue(undefined),
        all: vi.fn().mockReturnValue([]),
      }));

      const transactions = [
        createMockTransaction({
          description: 'UNKNOWN MERCHANT',
          isIncome: false,
        }),
      ];
      const result = applyCategorySuggestions(transactions, 'novo_banco', DEFAULT_WORKSPACE_ID);

      expect(result[0].suggestedCategoryId).toBeNull();
      expect(result[0].suggestedCategoryName).toBeNull();
    });

    it('should process multiple transactions', () => {
      const mockPatterns = [
        { id: 1, category_id: 1, category_name: 'Groceries', pattern: 'pingo doce', priority: 0 },
        { id: 2, category_id: 2, category_name: 'Transport', pattern: 'uber', priority: 0 },
      ];
      const incomeCategory = { id: 10, name: 'Income' };
      const otherCategory = { id: 99, name: 'Other' };

      mockDb.prepare.mockImplementation((sql: string) => {
        if (sql.includes("name = 'Income'")) {
          return { get: vi.fn().mockReturnValue(incomeCategory) };
        }
        if (sql.includes("name = 'Other'")) {
          return { get: vi.fn().mockReturnValue(otherCategory) };
        }
        return { all: vi.fn().mockReturnValue(mockPatterns) };
      });

      const transactions = [
        createMockTransaction({ description: 'PINGO DOCE', isIncome: false }),
        createMockTransaction({ description: 'UBER TRIP', isIncome: false }),
        createMockTransaction({ description: 'SALARY', isIncome: true }),
        createMockTransaction({ description: 'RANDOM', isIncome: false }),
      ];

      const result = applyCategorySuggestions(transactions, 'novo_banco', DEFAULT_WORKSPACE_ID);

      expect(result[0].suggestedCategoryName).toBe('Groceries');
      expect(result[1].suggestedCategoryName).toBe('Transport');
      expect(result[2].suggestedCategoryName).toBe('Income');
      expect(result[3].suggestedCategoryName).toBe('Other');
    });
  });
});
