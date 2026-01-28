import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the database module
vi.mock('../db/database.js', () => ({
  getDatabase: vi.fn(),
}));

vi.mock('./recurringDetector.js', () => ({
  getRecurringSummary: vi.fn(),
}));

import { getDatabase } from '../db/database.js';
import { getDashboardData, getAvailableYears } from './dashboardService.js';
import { getRecurringSummary } from './recurringDetector.js';

const DEFAULT_WORKSPACE_ID = 1;

describe('dashboardService', () => {
  const mockDb = {
    prepare: vi.fn(),
  };

  beforeEach(() => {
    vi.mocked(getDatabase).mockReturnValue(mockDb as any);
    vi.mocked(getRecurringSummary).mockReturnValue({
      totalActive: 2,
      estimatedMonthlyCost: 50.0,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('getDashboardData', () => {
    it('should return complete dashboard data structure', () => {
      // Mock summary query
      const mockSummary = {
        total_income: 5000,
        total_expenses: 3000,
        transaction_count: 50,
        period_start: '2024-11-01',
        period_end: '2024-11-30',
      };

      // Mock category breakdown
      const mockBreakdown = [
        {
          category_id: 1,
          category_name: 'Groceries',
          category_color: '#4CAF50',
          total: 500,
          count: 10,
        },
        {
          category_id: 2,
          category_name: 'Transport',
          category_color: '#2196F3',
          total: 300,
          count: 5,
        },
      ];

      // Mock monthly trends
      const mockTrends = [
        { month: '2024-10', income: 4500, expenses: 2800 },
        { month: '2024-11', income: 5000, expenses: 3000 },
      ];

      // Mock recent transactions
      const mockTransactions = [
        {
          id: 1,
          ledger_id: 1,
          date: '2024-11-15',
          description: 'Test Transaction',
          amount: 100,
          balance: 1000,
          category_id: 1,
          is_income: 0,
          raw_text: 'Test',
          created_at: '2024-11-15T10:00:00',
          cat_id: 1,
          cat_name: 'Groceries',
          cat_color: '#4CAF50',
          cat_icon: 'shopping-cart',
          cat_is_default: 1,
          cat_created_at: '2024-01-01T00:00:00',
        },
      ];

      mockDb.prepare.mockImplementation((sql: string) => {
        if (sql.includes('SUM(CASE WHEN is_income')) {
          if (sql.includes('GROUP BY month')) {
            return { all: vi.fn().mockReturnValue(mockTrends) };
          }
          return { get: vi.fn().mockReturnValue(mockSummary) };
        }
        if (sql.includes('GROUP BY t.category_id')) {
          return { all: vi.fn().mockReturnValue(mockBreakdown) };
        }
        if (sql.includes('LEFT JOIN categories c ON t.category_id')) {
          return { all: vi.fn().mockReturnValue(mockTransactions) };
        }
        return { get: vi.fn(), all: vi.fn().mockReturnValue([]) };
      });

      const result = getDashboardData({ workspaceId: DEFAULT_WORKSPACE_ID });

      expect(result).toHaveProperty('summary');
      expect(result).toHaveProperty('categoryBreakdown');
      expect(result).toHaveProperty('monthlyTrends');
      expect(result).toHaveProperty('recentTransactions');
      expect(result).toHaveProperty('recurringSummary');
      expect(result.recurringSummary).toEqual({
        totalActive: 2,
        estimatedMonthlyCost: 50.0,
      });
    });

    it('should calculate summary correctly', () => {
      const mockSummary = {
        total_income: 5000,
        total_expenses: 3000,
        transaction_count: 50,
        period_start: '2024-11-01',
        period_end: '2024-11-30',
      };

      mockDb.prepare.mockImplementation(() => ({
        get: vi.fn().mockReturnValue(mockSummary),
        all: vi.fn().mockReturnValue([]),
      }));

      const result = getDashboardData({ workspaceId: DEFAULT_WORKSPACE_ID });

      expect(result.summary.totalIncome).toBe(5000);
      expect(result.summary.totalExpenses).toBe(3000);
      expect(result.summary.balance).toBe(2000); // 5000 - 3000
      expect(result.summary.transactionCount).toBe(50);
    });

    it('should calculate category percentages correctly', () => {
      const mockSummary = {
        total_income: 0,
        total_expenses: 0,
        transaction_count: 0,
        period_start: null,
        period_end: null,
      };

      const mockBreakdown = [
        {
          category_id: 1,
          category_name: 'Groceries',
          category_color: '#4CAF50',
          total: 500,
          count: 10,
        },
        {
          category_id: 2,
          category_name: 'Transport',
          category_color: '#2196F3',
          total: 500,
          count: 5,
        },
      ];

      mockDb.prepare.mockImplementation((sql: string) => {
        if (sql.includes('GROUP BY t.category_id')) {
          return { all: vi.fn().mockReturnValue(mockBreakdown) };
        }
        return {
          get: vi.fn().mockReturnValue(mockSummary),
          all: vi.fn().mockReturnValue([]),
        };
      });

      const result = getDashboardData({ workspaceId: DEFAULT_WORKSPACE_ID });

      // Each category is 50% of total (500 / 1000 * 100)
      expect(result.categoryBreakdown[0].percentage).toBe(50);
      expect(result.categoryBreakdown[1].percentage).toBe(50);
    });

    it('should handle zero expenses in percentage calculation', () => {
      const mockSummary = {
        total_income: 0,
        total_expenses: 0,
        transaction_count: 0,
        period_start: null,
        period_end: null,
      };

      const mockBreakdown: any[] = [];

      mockDb.prepare.mockImplementation((sql: string) => {
        if (sql.includes('GROUP BY t.category_id')) {
          return { all: vi.fn().mockReturnValue(mockBreakdown) };
        }
        return {
          get: vi.fn().mockReturnValue(mockSummary),
          all: vi.fn().mockReturnValue([]),
        };
      });

      const result = getDashboardData({ workspaceId: DEFAULT_WORKSPACE_ID });

      expect(result.categoryBreakdown).toEqual([]);
    });

    it('should calculate monthly balance correctly', () => {
      const mockSummary = {
        total_income: 0,
        total_expenses: 0,
        transaction_count: 0,
        period_start: null,
        period_end: null,
      };

      const mockTrends = [
        { month: '2024-10', income: 4500, expenses: 2800 },
        { month: '2024-11', income: 5000, expenses: 3000 },
      ];

      mockDb.prepare.mockImplementation((sql: string) => {
        if (sql.includes('GROUP BY month')) {
          return { all: vi.fn().mockReturnValue(mockTrends) };
        }
        return {
          get: vi.fn().mockReturnValue(mockSummary),
          all: vi.fn().mockReturnValue([]),
        };
      });

      const result = getDashboardData({ workspaceId: DEFAULT_WORKSPACE_ID });

      expect(result.monthlyTrends[0].balance).toBe(1700); // 4500 - 2800
      expect(result.monthlyTrends[1].balance).toBe(2000); // 5000 - 3000
    });

    it('should include recurringSummary from getRecurringSummary', () => {
      const mockSummary = {
        total_income: 0,
        total_expenses: 0,
        transaction_count: 0,
        period_start: null,
        period_end: null,
      };

      vi.mocked(getRecurringSummary).mockReturnValue({
        totalActive: 5,
        estimatedMonthlyCost: 250.75,
      });

      mockDb.prepare.mockImplementation(() => ({
        get: vi.fn().mockReturnValue(mockSummary),
        all: vi.fn().mockReturnValue([]),
      }));

      const result = getDashboardData({ workspaceId: DEFAULT_WORKSPACE_ID });

      expect(getRecurringSummary).toHaveBeenCalledWith(DEFAULT_WORKSPACE_ID);
      expect(result.recurringSummary).toEqual({
        totalActive: 5,
        estimatedMonthlyCost: 250.75,
      });
    });
  });

  describe('getDashboardData with filters', () => {
    it('should filter by year', () => {
      const mockSummary = {
        total_income: 5000,
        total_expenses: 3000,
        transaction_count: 50,
        period_start: '2024-01-01',
        period_end: '2024-12-31',
      };

      let capturedSql = '';
      let capturedParams: unknown[] = [];

      mockDb.prepare.mockImplementation((sql: string) => ({
        get: vi.fn((...params: unknown[]) => {
          capturedSql = sql;
          capturedParams = params;
          return mockSummary;
        }),
        all: vi.fn((...params: unknown[]) => {
          capturedSql = sql;
          capturedParams = params;
          return [];
        }),
      }));

      getDashboardData({ workspaceId: DEFAULT_WORKSPACE_ID, year: 2024 });

      expect(capturedSql).toContain('t.date >= ?');
      expect(capturedSql).toContain('t.date < ?');
      expect(capturedParams).toContain('2024-01-01');
      expect(capturedParams).toContain('2025-01-01');
    });

    it('should filter by year and month with range comparisons', () => {
      const mockSummary = {
        total_income: 5000,
        total_expenses: 3000,
        transaction_count: 50,
        period_start: '2024-01-01',
        period_end: '2024-01-31',
      };

      let capturedSql = '';
      let capturedParams: unknown[] = [];

      mockDb.prepare.mockImplementation((sql: string) => ({
        get: vi.fn((...params: unknown[]) => {
          capturedSql = sql;
          capturedParams = params;
          return mockSummary;
        }),
        all: vi.fn((...params: unknown[]) => {
          capturedSql = sql;
          capturedParams = params;
          return [];
        }),
      }));

      getDashboardData({ workspaceId: DEFAULT_WORKSPACE_ID, year: 2024, month: 1 });

      // Month range: 2024-01-01 to 2024-02-01
      expect(capturedSql).toContain('t.date >= ?');
      expect(capturedSql).toContain('t.date < ?');
      expect(capturedParams).toContain('2024-01-01');
      expect(capturedParams).toContain('2024-02-01');
    });

    it('should filter by category', () => {
      const mockSummary = {
        total_income: 5000,
        total_expenses: 3000,
        transaction_count: 50,
        period_start: null,
        period_end: null,
      };

      let capturedSql = '';
      let capturedParams: unknown[] = [];

      mockDb.prepare.mockImplementation((sql: string) => ({
        get: vi.fn((...params: unknown[]) => {
          capturedSql = sql;
          capturedParams = params;
          return mockSummary;
        }),
        all: vi.fn((...params: unknown[]) => {
          capturedSql = sql;
          capturedParams = params;
          return [];
        }),
      }));

      getDashboardData({ workspaceId: DEFAULT_WORKSPACE_ID, categoryId: 5 });

      expect(capturedSql).toContain('t.category_id = ?');
      expect(capturedParams).toContain(5);
    });

    it('should combine multiple filters', () => {
      const mockSummary = {
        total_income: 5000,
        total_expenses: 3000,
        transaction_count: 50,
        period_start: null,
        period_end: null,
      };

      let capturedSql = '';

      mockDb.prepare.mockImplementation((sql: string) => ({
        get: vi.fn(() => {
          capturedSql = sql;
          return mockSummary;
        }),
        all: vi.fn(() => {
          capturedSql = sql;
          return [];
        }),
      }));

      getDashboardData({ workspaceId: DEFAULT_WORKSPACE_ID, year: 2024, month: 11 });

      expect(capturedSql).toContain('t.date >= ?');
      expect(capturedSql).toContain('t.date < ?');
    });
  });

  describe('getAvailableYears', () => {
    it('should return list of years as numbers', () => {
      const mockYears = [{ year: '2024' }, { year: '2023' }, { year: '2022' }];

      mockDb.prepare.mockReturnValue({
        all: vi.fn().mockReturnValue(mockYears),
      });

      const result = getAvailableYears(DEFAULT_WORKSPACE_ID);

      expect(result).toEqual([2024, 2023, 2022]);
    });

    it('should return empty array when no transactions', () => {
      mockDb.prepare.mockReturnValue({
        all: vi.fn().mockReturnValue([]),
      });

      const result = getAvailableYears(DEFAULT_WORKSPACE_ID);

      expect(result).toEqual([]);
    });

    it('should query distinct years ordered descending', () => {
      let capturedSql = '';

      mockDb.prepare.mockImplementation((sql: string) => {
        capturedSql = sql;
        return { all: vi.fn().mockReturnValue([]) };
      });

      getAvailableYears(DEFAULT_WORKSPACE_ID);

      expect(capturedSql).toContain('DISTINCT');
      expect(capturedSql).toContain("substr(t.date, 1, 4)");
      expect(capturedSql).toContain('ORDER BY year DESC');
    });
  });

  describe('recentTransactions', () => {
    it('should transform database results to TransactionWithCategory', () => {
      const mockSummary = {
        total_income: 0,
        total_expenses: 0,
        transaction_count: 0,
        period_start: null,
        period_end: null,
      };

      const mockTransactions = [
        {
          id: 1,
          ledger_id: 1,
          date: '2024-11-15',
          description: 'Test Transaction',
          amount: 100,
          balance: 1000,
          category_id: 1,
          is_income: 0,
          raw_text: 'Raw test',
          created_at: '2024-11-15T10:00:00',
          cat_id: 1,
          cat_name: 'Groceries',
          cat_color: '#4CAF50',
          cat_icon: 'cart',
          cat_is_default: 1,
          cat_created_at: '2024-01-01T00:00:00',
        },
      ];

      mockDb.prepare.mockImplementation((sql: string) => {
        if (sql.includes('LEFT JOIN categories c ON t.category_id') && sql.includes('LIMIT')) {
          return { all: vi.fn().mockReturnValue(mockTransactions) };
        }
        return {
          get: vi.fn().mockReturnValue(mockSummary),
          all: vi.fn().mockReturnValue([]),
        };
      });

      const result = getDashboardData({ workspaceId: DEFAULT_WORKSPACE_ID });
      const tx = result.recentTransactions[0];

      expect(tx.id).toBe(1);
      expect(tx.ledgerId).toBe(1);
      expect(tx.date).toBe('2024-11-15');
      expect(tx.isIncome).toBe(false); // is_income: 0 -> false
      expect(tx.category).not.toBeNull();
      expect(tx.category?.name).toBe('Groceries');
    });

    it('should handle transactions without category', () => {
      const mockSummary = {
        total_income: 0,
        total_expenses: 0,
        transaction_count: 0,
        period_start: null,
        period_end: null,
      };

      const mockTransactions = [
        {
          id: 1,
          ledger_id: 1,
          date: '2024-11-15',
          description: 'Uncategorized Transaction',
          amount: 100,
          balance: 1000,
          category_id: null,
          is_income: 1,
          raw_text: 'Raw test',
          created_at: '2024-11-15T10:00:00',
          cat_id: null,
          cat_name: null,
          cat_color: null,
          cat_icon: null,
          cat_is_default: null,
          cat_created_at: null,
        },
      ];

      mockDb.prepare.mockImplementation((sql: string) => {
        if (sql.includes('LEFT JOIN categories c ON t.category_id') && sql.includes('LIMIT')) {
          return { all: vi.fn().mockReturnValue(mockTransactions) };
        }
        return {
          get: vi.fn().mockReturnValue(mockSummary),
          all: vi.fn().mockReturnValue([]),
        };
      });

      const result = getDashboardData({ workspaceId: DEFAULT_WORKSPACE_ID });
      const tx = result.recentTransactions[0];

      expect(tx.isIncome).toBe(true); // is_income: 1 -> true
      expect(tx.category).toBeNull();
    });
  });
});
