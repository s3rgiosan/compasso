import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DEFAULT_CATEGORIES, getLocalizedCategories, CATEGORY_NAME_TRANSLATIONS } from '@compasso/shared';
import { SUPPORTED_BANKS, BANK_CATEGORY_PATTERNS } from '../parsers/registry.js';

// Mock the database module
vi.mock('./database.js', () => ({
  getDatabase: vi.fn(),
}));

import { getDatabase } from './database.js';
import { seedCategoriesForWorkspace } from './seed.js';

describe('seedCategoriesForWorkspace', () => {
  const mockDb = {
    prepare: vi.fn(),
    transaction: vi.fn(),
  };

  const mockInsertCategory = {
    run: vi.fn(),
  };

  const mockInsertPattern = {
    run: vi.fn(),
  };

  beforeEach(() => {
    vi.mocked(getDatabase).mockReturnValue(mockDb as unknown as ReturnType<typeof getDatabase>);

    // Track category IDs for linking patterns
    let categoryIdCounter = 1;
    mockInsertCategory.run.mockImplementation(() => ({
      lastInsertRowid: categoryIdCounter++,
    }));

    mockInsertPattern.run.mockReset();

    mockDb.prepare.mockImplementation((sql: string) => {
      if (sql.includes('INSERT INTO categories')) {
        return mockInsertCategory;
      }
      if (sql.includes('INSERT INTO category_patterns')) {
        return mockInsertPattern;
      }
      return { run: vi.fn() };
    });

    // Mock transaction to execute immediately
    // eslint-disable-next-line @typescript-eslint/ban-types
    mockDb.transaction.mockImplementation((fn: Function) => {
      const transactionFn = () => fn();
      transactionFn.immediate = () => fn();
      return transactionFn;
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should create all default categories for workspace', () => {
    const workspaceId = 42;

    seedCategoriesForWorkspace(workspaceId);

    // Verify each default category was inserted
    expect(mockInsertCategory.run).toHaveBeenCalledTimes(DEFAULT_CATEGORIES.length);

    // Check that each category was created with correct data
    DEFAULT_CATEGORIES.forEach((category, index) => {
      expect(mockInsertCategory.run).toHaveBeenNthCalledWith(
        index + 1,
        category.name,
        category.color,
        category.icon,
        workspaceId
      );
    });
  });

  it('should create all patterns for each category', () => {
    const workspaceId = 1;

    seedCategoriesForWorkspace(workspaceId);

    // Count total expected patterns across all banks
    let expectedPatternCount = 0;
    for (const bankId of Object.values(SUPPORTED_BANKS)) {
      const bankPatterns = BANK_CATEGORY_PATTERNS[bankId];
      if (!bankPatterns) continue;

      for (const patterns of Object.values(bankPatterns)) {
        expectedPatternCount += patterns.length;
      }
    }

    expect(mockInsertPattern.run).toHaveBeenCalledTimes(expectedPatternCount);
  });

  it('should use correct workspace ID for all inserts', () => {
    const workspaceId = 99;

    seedCategoriesForWorkspace(workspaceId);

    // Verify all category inserts used the correct workspace ID
    const allCategoryCalls = mockInsertCategory.run.mock.calls;
    allCategoryCalls.forEach((call) => {
      expect(call[3]).toBe(workspaceId); // workspace_id is the 4th parameter
    });
  });

  it('should run in a transaction (all or nothing)', () => {
    const workspaceId = 1;

    seedCategoriesForWorkspace(workspaceId);

    // Verify transaction was created and executed with immediate mode
    expect(mockDb.transaction).toHaveBeenCalledTimes(1);
    expect(mockDb.transaction).toHaveBeenCalledWith(expect.any(Function));
  });

  it('should create categories with correct colors and icons from constants', () => {
    const workspaceId = 1;

    seedCategoriesForWorkspace(workspaceId);

    // Verify specific categories have correct attributes
    const groceriesCategory = DEFAULT_CATEGORIES.find((c) => c.name === 'Groceries');
    const incomeCategory = DEFAULT_CATEGORIES.find((c) => c.name === 'Income');
    const otherCategory = DEFAULT_CATEGORIES.find((c) => c.name === 'Other');

    expect(groceriesCategory).toBeDefined();
    expect(incomeCategory).toBeDefined();
    expect(otherCategory).toBeDefined();

    // Check that these specific categories were created with their correct attributes
    const categoryCalls = mockInsertCategory.run.mock.calls;

    // Find the Groceries call
    const groceriesCall = categoryCalls.find((call) => call[0] === 'Groceries');
    expect(groceriesCall).toBeDefined();
    expect(groceriesCall![1]).toBe(groceriesCategory!.color);
    expect(groceriesCall![2]).toBe(groceriesCategory!.icon);

    // Find the Income call
    const incomeCall = categoryCalls.find((call) => call[0] === 'Income');
    expect(incomeCall).toBeDefined();
    expect(incomeCall![1]).toBe(incomeCategory!.color);
    expect(incomeCall![2]).toBe(incomeCategory!.icon);

    // Find the Other call
    const otherCall = categoryCalls.find((call) => call[0] === 'Other');
    expect(otherCall).toBeDefined();
    expect(otherCall![1]).toBe(otherCategory!.color);
    expect(otherCall![2]).toBe(otherCategory!.icon);
  });

  it('should link patterns to correct category IDs', () => {
    const workspaceId = 1;

    // Build expected category ID mapping based on insertion order
    const expectedCategoryIds: Record<string, number> = {};
    DEFAULT_CATEGORIES.forEach((category, index) => {
      expectedCategoryIds[category.name] = index + 1;
    });

    seedCategoriesForWorkspace(workspaceId);

    // Verify patterns are linked to correct category IDs
    const patternCalls = mockInsertPattern.run.mock.calls;

    for (const bankId of Object.values(SUPPORTED_BANKS)) {
      const bankPatterns = BANK_CATEGORY_PATTERNS[bankId];
      if (!bankPatterns) continue;

      for (const [categoryName, patterns] of Object.entries(bankPatterns)) {
        const expectedCategoryId = expectedCategoryIds[categoryName];
        if (!expectedCategoryId) continue;

        // Find pattern calls for this category and bank
        patterns.forEach((pattern, priority) => {
          const matchingCall = patternCalls.find(
            (call) =>
              call[0] === expectedCategoryId &&
              call[1] === bankId &&
              call[2] === pattern &&
              call[3] === priority
          );
          expect(matchingCall).toBeDefined();
        });
      }
    }
  });

  it('should set pattern priorities based on array index', () => {
    const workspaceId = 1;

    seedCategoriesForWorkspace(workspaceId);

    const patternCalls = mockInsertPattern.run.mock.calls;

    // For each bank, verify patterns have sequential priorities starting from 0
    for (const bankId of Object.values(SUPPORTED_BANKS)) {
      const bankPatterns = BANK_CATEGORY_PATTERNS[bankId];
      if (!bankPatterns) continue;

      for (const patterns of Object.values(bankPatterns)) {
        patterns.forEach((pattern, expectedPriority) => {
          const matchingCall = patternCalls.find(
            (call) => call[1] === bankId && call[2] === pattern
          );
          expect(matchingCall).toBeDefined();
          expect(matchingCall![3]).toBe(expectedPriority); // priority is the 4th parameter
        });
      }
    }
  });

  it('should create Portuguese category names when locale is pt', () => {
    const workspaceId = 1;

    seedCategoriesForWorkspace(workspaceId, 'pt');

    const categoryCalls = mockInsertCategory.run.mock.calls;

    // Verify Portuguese names were used
    const localizedCategories = getLocalizedCategories('pt');
    expect(categoryCalls.length).toBe(localizedCategories.length);

    localizedCategories.forEach((category, index) => {
      expect(categoryCalls[index][0]).toBe(category.name);
    });

    // Spot-check specific Portuguese translations
    const groceriesCall = categoryCalls.find(
      (call) => call[0] === CATEGORY_NAME_TRANSLATIONS['Groceries'].pt
    );
    expect(groceriesCall).toBeDefined();
    expect(groceriesCall![0]).toBe('Mercearia');

    const incomeCall = categoryCalls.find(
      (call) => call[0] === CATEGORY_NAME_TRANSLATIONS['Income'].pt
    );
    expect(incomeCall).toBeDefined();
    expect(incomeCall![0]).toBe('Receitas');
  });

  it('should link patterns to correct localized category IDs for pt locale', () => {
    const workspaceId = 1;

    seedCategoriesForWorkspace(workspaceId, 'pt');

    const patternCalls = mockInsertPattern.run.mock.calls;

    // Build expected category ID mapping based on localized insertion order
    const localizedCategories = getLocalizedCategories('pt');
    const localizedCategoryIds: Record<string, number> = {};
    localizedCategories.forEach((category, index) => {
      localizedCategoryIds[category.name] = index + 1;
    });

    // Build reverse map: English -> Portuguese
    const englishToPortuguese: Record<string, string> = {};
    for (const cat of DEFAULT_CATEGORIES) {
      englishToPortuguese[cat.name] = CATEGORY_NAME_TRANSLATIONS[cat.name]?.pt ?? cat.name;
    }

    // Verify patterns reference the correct localized category IDs
    for (const bankId of Object.values(SUPPORTED_BANKS)) {
      const bankPatterns = BANK_CATEGORY_PATTERNS[bankId];
      if (!bankPatterns) continue;

      for (const [englishName, patterns] of Object.entries(bankPatterns)) {
        const ptName = englishToPortuguese[englishName];
        const expectedCategoryId = localizedCategoryIds[ptName];
        if (!expectedCategoryId) continue;

        patterns.forEach((pattern, priority) => {
          const matchingCall = patternCalls.find(
            (call) =>
              call[0] === expectedCategoryId &&
              call[1] === bankId &&
              call[2] === pattern &&
              call[3] === priority
          );
          expect(matchingCall).toBeDefined();
        });
      }
    }
  });
});
