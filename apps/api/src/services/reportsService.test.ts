import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../db/database.js', () => ({
  getDatabase: vi.fn(),
}));

import { getDatabase } from '../db/database.js';
import {
  getYearlySummary,
  getCategoryTrends,
  getAvailableYearsForReports,
} from './reportsService.js';

describe('reportsService', () => {
  const mockDb = {
    prepare: vi.fn(),
  };

  beforeEach(() => {
    vi.mocked(getDatabase).mockReturnValue(mockDb as any);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('getYearlySummary', () => {
    it('should return yearly summary with totals and breakdowns', () => {
      const yearlyTotals = {
        total_income: 5000,
        total_expenses: 3000,
        transaction_count: 50,
      };
      const categoryBreakdown = [
        { category_id: 1, category_name: 'Groceries', category_color: '#22c55e', total: 1500, count: 20 },
        { category_id: 2, category_name: 'Transport', category_color: '#3b82f6', total: 1500, count: 30 },
      ];
      const monthlyBreakdown = [
        { month: '2024-01', income: 2500, expenses: 1500 },
        { month: '2024-02', income: 2500, expenses: 1500 },
      ];

      let callIndex = 0;
      mockDb.prepare.mockImplementation(() => {
        callIndex++;
        if (callIndex === 1) {
          return { get: vi.fn().mockReturnValue(yearlyTotals) };
        }
        if (callIndex === 2) {
          return { all: vi.fn().mockReturnValue(categoryBreakdown) };
        }
        if (callIndex === 3) {
          return { all: vi.fn().mockReturnValue(monthlyBreakdown) };
        }
        return { get: vi.fn(), all: vi.fn().mockReturnValue([]) };
      });

      const result = getYearlySummary(1, 2024);

      expect(result.year).toBe(2024);
      expect(result.totalIncome).toBe(5000);
      expect(result.totalExpenses).toBe(3000);
      expect(result.netSavings).toBe(2000);
      expect(result.savingsRate).toBe(40);
      expect(result.transactionCount).toBe(50);
      expect(result.categoryBreakdown).toHaveLength(2);
      expect(result.categoryBreakdown[0].percentage).toBe(50);
      expect(result.categoryBreakdown[1].percentage).toBe(50);
      expect(result.monthlyBreakdown).toHaveLength(2);
      expect(result.monthlyBreakdown[0].netSavings).toBe(1000);
    });

    it('should handle zero income (savingsRate = 0)', () => {
      mockDb.prepare.mockImplementation(() => ({
        get: vi.fn().mockReturnValue({
          total_income: 0,
          total_expenses: 500,
          transaction_count: 5,
        }),
        all: vi.fn().mockReturnValue([]),
      }));

      const result = getYearlySummary(1, 2024);

      expect(result.savingsRate).toBe(0);
      expect(result.netSavings).toBe(-500);
    });

    it('should handle null totals', () => {
      mockDb.prepare.mockImplementation(() => ({
        get: vi.fn().mockReturnValue({
          total_income: null,
          total_expenses: null,
          transaction_count: 0,
        }),
        all: vi.fn().mockReturnValue([]),
      }));

      const result = getYearlySummary(1, 2024);

      expect(result.totalIncome).toBe(0);
      expect(result.totalExpenses).toBe(0);
      expect(result.netSavings).toBe(0);
    });
  });

  describe('getCategoryTrends', () => {
    it('should return category trends with direction', () => {
      const monthlyData = [
        { category_id: 1, category_name: 'Groceries', category_color: '#22c55e', month: '2024-01', total: 100 },
        { category_id: 1, category_name: 'Groceries', category_color: '#22c55e', month: '2024-02', total: 100 },
        { category_id: 1, category_name: 'Groceries', category_color: '#22c55e', month: '2024-03', total: 200 },
        { category_id: 1, category_name: 'Groceries', category_color: '#22c55e', month: '2024-04', total: 200 },
      ];

      mockDb.prepare.mockReturnValue({
        all: vi.fn().mockReturnValue(monthlyData),
      });

      const result = getCategoryTrends(1, 12);

      expect(result).toHaveLength(1);
      expect(result[0].categoryName).toBe('Groceries');
      expect(result[0].monthlyData).toHaveLength(4);
      expect(result[0].avgMonthly).toBe(150);
      expect(result[0].trend).toBe('up'); // second half avg (200) > first half avg (100) by >10%
    });

    it('should detect downward trends', () => {
      const monthlyData = [
        { category_id: 1, category_name: 'Groceries', category_color: '#22c55e', month: '2024-01', total: 300 },
        { category_id: 1, category_name: 'Groceries', category_color: '#22c55e', month: '2024-02', total: 300 },
        { category_id: 1, category_name: 'Groceries', category_color: '#22c55e', month: '2024-03', total: 100 },
        { category_id: 1, category_name: 'Groceries', category_color: '#22c55e', month: '2024-04', total: 100 },
      ];

      mockDb.prepare.mockReturnValue({
        all: vi.fn().mockReturnValue(monthlyData),
      });

      const result = getCategoryTrends(1, 12);

      expect(result[0].trend).toBe('down');
    });

    it('should detect stable trends', () => {
      const monthlyData = [
        { category_id: 1, category_name: 'Groceries', category_color: '#22c55e', month: '2024-01', total: 100 },
        { category_id: 1, category_name: 'Groceries', category_color: '#22c55e', month: '2024-02', total: 105 },
        { category_id: 1, category_name: 'Groceries', category_color: '#22c55e', month: '2024-03', total: 100 },
        { category_id: 1, category_name: 'Groceries', category_color: '#22c55e', month: '2024-04', total: 105 },
      ];

      mockDb.prepare.mockReturnValue({
        all: vi.fn().mockReturnValue(monthlyData),
      });

      const result = getCategoryTrends(1, 12);

      expect(result[0].trend).toBe('stable');
    });

    it('should return empty array when no data', () => {
      mockDb.prepare.mockReturnValue({
        all: vi.fn().mockReturnValue([]),
      });

      const result = getCategoryTrends(1, 12);

      expect(result).toEqual([]);
    });

    it('should sort by average monthly spending (highest first)', () => {
      const monthlyData = [
        { category_id: 1, category_name: 'Small', category_color: '#aaa', month: '2024-01', total: 50 },
        { category_id: 2, category_name: 'Big', category_color: '#bbb', month: '2024-01', total: 500 },
      ];

      mockDb.prepare.mockReturnValue({
        all: vi.fn().mockReturnValue(monthlyData),
      });

      const result = getCategoryTrends(1, 12);

      expect(result[0].categoryName).toBe('Big');
      expect(result[1].categoryName).toBe('Small');
    });
  });

  describe('getAvailableYearsForReports', () => {
    it('should return available years as numbers', () => {
      mockDb.prepare.mockReturnValue({
        all: vi.fn().mockReturnValue([
          { year: '2024' },
          { year: '2023' },
        ]),
      });

      const result = getAvailableYearsForReports(1);

      expect(result).toEqual([2024, 2023]);
    });

    it('should return empty array when no data', () => {
      mockDb.prepare.mockReturnValue({
        all: vi.fn().mockReturnValue([]),
      });

      const result = getAvailableYearsForReports(1);

      expect(result).toEqual([]);
    });
  });
});
