import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../db/database.js', () => ({
  getDatabase: vi.fn(),
}));

import { getDatabase } from '../db/database.js';
import {
  detectRecurringPatterns,
  getRecurringPatterns,
  togglePatternActive,
  deletePattern,
  getPatternTransactions,
  updatePattern,
  getRecurringSummary,
} from './recurringDetector.js';

describe('recurringDetector', () => {
  const mockDb = {
    prepare: vi.fn(),
    transaction: vi.fn((fn: any) => fn),
  };

  beforeEach(() => {
    vi.mocked(getDatabase).mockReturnValue(mockDb as any);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('getRecurringPatterns', () => {
    it('should return formatted patterns', () => {
      const dbPatterns = [
        {
          id: 1,
          description_pattern: 'NETFLIX',
          frequency: 'monthly',
          avg_amount: 12.99,
          occurrence_count: 6,
          is_active: 1,
          created_at: '2024-01-01',
        },
        {
          id: 2,
          description_pattern: 'GYM',
          frequency: 'monthly',
          avg_amount: 30.0,
          occurrence_count: 4,
          is_active: 0,
          created_at: '2024-02-01',
        },
      ];

      mockDb.prepare.mockReturnValue({
        all: vi.fn().mockReturnValue(dbPatterns),
      });

      const result = getRecurringPatterns(1);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: 1,
        descriptionPattern: 'NETFLIX',
        frequency: 'monthly',
        avgAmount: 12.99,
        occurrenceCount: 6,
        isActive: true,
        createdAt: '2024-01-01',
      });
      expect(result[1].isActive).toBe(false);
    });

    it('should return empty array when no patterns', () => {
      mockDb.prepare.mockReturnValue({
        all: vi.fn().mockReturnValue([]),
      });

      const result = getRecurringPatterns(1);

      expect(result).toEqual([]);
    });
  });

  describe('togglePatternActive', () => {
    it('should activate a pattern when user has access', () => {
      const mockGet = vi.fn().mockReturnValue({ id: 1 });
      const mockRun = vi.fn().mockReturnValue({ changes: 1 });

      mockDb.prepare.mockImplementation((sql: string) => {
        if (sql.includes('SELECT rp.id')) {
          return { get: mockGet };
        }
        if (sql.includes('UPDATE recurring_patterns')) {
          return { run: mockRun };
        }
        return { get: vi.fn(), run: vi.fn() };
      });

      const result = togglePatternActive(1, true, 10);

      expect(result).toBe(true);
      expect(mockRun).toHaveBeenCalledWith(1, 1);
    });

    it('should deactivate a pattern', () => {
      const mockGet = vi.fn().mockReturnValue({ id: 1 });
      const mockRun = vi.fn().mockReturnValue({ changes: 1 });

      mockDb.prepare.mockImplementation((sql: string) => {
        if (sql.includes('SELECT rp.id')) {
          return { get: mockGet };
        }
        if (sql.includes('UPDATE recurring_patterns')) {
          return { run: mockRun };
        }
        return { get: vi.fn(), run: vi.fn() };
      });

      const result = togglePatternActive(1, false, 10);

      expect(result).toBe(true);
      expect(mockRun).toHaveBeenCalledWith(0, 1);
    });

    it('should return false when pattern not found or user has no access', () => {
      mockDb.prepare.mockReturnValue({
        get: vi.fn().mockReturnValue(undefined),
        run: vi.fn(),
      });

      const result = togglePatternActive(999, true, 10);

      expect(result).toBe(false);
    });
  });

  describe('detectRecurringPatterns', () => {
    it('should detect monthly patterns from transactions', () => {
      // Create transactions with monthly intervals (~30 days apart)
      const transactions = [
        { id: 1, description: 'NETFLIX PAYMENT', amount: -12.99, date: '2024-01-15', is_income: 0 },
        { id: 2, description: 'NETFLIX PAYMENT', amount: -12.99, date: '2024-02-15', is_income: 0 },
        { id: 3, description: 'NETFLIX PAYMENT', amount: -12.99, date: '2024-03-15', is_income: 0 },
        { id: 4, description: 'NETFLIX PAYMENT', amount: -12.99, date: '2024-04-15', is_income: 0 },
      ];

      const mockInsertRun = vi.fn().mockReturnValue({ lastInsertRowid: 100 });
      const mockUpdateRun = vi.fn();

      mockDb.prepare.mockImplementation((sql: string) => {
        if (sql.includes('SELECT t.id')) {
          return { all: vi.fn().mockReturnValue(transactions) };
        }
        if (sql.includes('INSERT INTO recurring_patterns')) {
          return { run: mockInsertRun };
        }
        if (sql.includes('SELECT id FROM recurring_patterns')) {
          return { get: vi.fn().mockReturnValue(undefined) }; // No existing pattern
        }
        if (sql.includes('UPDATE transactions SET recurring_pattern_id')) {
          return { run: mockUpdateRun };
        }
        if (sql.includes('UPDATE recurring_patterns')) {
          return { run: vi.fn() };
        }
        return { get: vi.fn(), all: vi.fn().mockReturnValue([]), run: vi.fn() };
      });

      const result = detectRecurringPatterns(1);

      expect(result.detected).toBeGreaterThanOrEqual(1);
      expect(result.patterns.length).toBeGreaterThanOrEqual(1);

      const pattern = result.patterns[0];
      expect(pattern.frequency).toBe('monthly');
      expect(pattern.avgAmount).toBeCloseTo(12.99, 1);
      expect(pattern.transactionIds).toEqual([1, 2, 3, 4]);
    });

    it('should not detect patterns with fewer than 3 transactions', () => {
      const transactions = [
        { id: 1, description: 'RARE PAYMENT', amount: -50, date: '2024-01-15', is_income: 0 },
        { id: 2, description: 'RARE PAYMENT', amount: -50, date: '2024-02-15', is_income: 0 },
      ];

      mockDb.prepare.mockImplementation((sql: string) => {
        if (sql.includes('SELECT t.id')) {
          return { all: vi.fn().mockReturnValue(transactions) };
        }
        return {
          get: vi.fn().mockReturnValue(undefined),
          all: vi.fn().mockReturnValue([]),
          run: vi.fn().mockReturnValue({ lastInsertRowid: 1 }),
        };
      });

      const result = detectRecurringPatterns(1);

      expect(result.patterns).toHaveLength(0);
      expect(result.detected).toBe(0);
    });

    it('should not detect patterns with inconsistent intervals', () => {
      // Transactions with irregular intervals
      const transactions = [
        { id: 1, description: 'IRREGULAR PAYMENT', amount: -25, date: '2024-01-01', is_income: 0 },
        { id: 2, description: 'IRREGULAR PAYMENT', amount: -25, date: '2024-01-10', is_income: 0 },
        { id: 3, description: 'IRREGULAR PAYMENT', amount: -25, date: '2024-04-01', is_income: 0 },
        { id: 4, description: 'IRREGULAR PAYMENT', amount: -25, date: '2024-04-05', is_income: 0 },
      ];

      mockDb.prepare.mockImplementation((sql: string) => {
        if (sql.includes('SELECT t.id')) {
          return { all: vi.fn().mockReturnValue(transactions) };
        }
        return {
          get: vi.fn().mockReturnValue(undefined),
          all: vi.fn().mockReturnValue([]),
          run: vi.fn().mockReturnValue({ lastInsertRowid: 1 }),
        };
      });

      const result = detectRecurringPatterns(1);

      // Should not detect a pattern due to inconsistent intervals
      expect(result.patterns).toHaveLength(0);
    });

    it('should update existing pattern instead of creating new', () => {
      const transactions = [
        { id: 1, description: 'SPOTIFY', amount: -9.99, date: '2024-01-01', is_income: 0 },
        { id: 2, description: 'SPOTIFY', amount: -9.99, date: '2024-02-01', is_income: 0 },
        { id: 3, description: 'SPOTIFY', amount: -9.99, date: '2024-03-01', is_income: 0 },
      ];

      const existingPattern = { id: 42 };
      const mockUpdatePattern = vi.fn();
      const mockUpdateTx = vi.fn();

      mockDb.prepare.mockImplementation((sql: string) => {
        if (sql.includes('SELECT t.id')) {
          return { all: vi.fn().mockReturnValue(transactions) };
        }
        if (sql.includes('SELECT id FROM recurring_patterns')) {
          return { get: vi.fn().mockReturnValue(existingPattern) };
        }
        if (sql.includes('UPDATE recurring_patterns SET occurrence_count')) {
          return { run: mockUpdatePattern };
        }
        if (sql.includes('UPDATE transactions SET recurring_pattern_id')) {
          return { run: mockUpdateTx };
        }
        if (sql.includes('INSERT INTO recurring_patterns')) {
          return { run: vi.fn().mockReturnValue({ lastInsertRowid: 100 }) };
        }
        return { get: vi.fn(), all: vi.fn().mockReturnValue([]), run: vi.fn() };
      });

      const result = detectRecurringPatterns(1);

      // Should not increment detected count for existing patterns
      expect(result.detected).toBe(0);
      expect(result.patterns.length).toBeGreaterThanOrEqual(1);
    });

    it('should handle empty transaction list', () => {
      mockDb.prepare.mockImplementation((sql: string) => {
        if (sql.includes('SELECT t.id')) {
          return { all: vi.fn().mockReturnValue([]) };
        }
        return {
          get: vi.fn().mockReturnValue(undefined),
          all: vi.fn().mockReturnValue([]),
          run: vi.fn().mockReturnValue({ lastInsertRowid: 1 }),
        };
      });

      const result = detectRecurringPatterns(1);

      expect(result.detected).toBe(0);
      expect(result.patterns).toEqual([]);
    });

    it('should separate income and expense analysis', () => {
      // Mix of income and expense with same description
      const transactions = [
        { id: 1, description: 'COMPANY X', amount: 2000, date: '2024-01-01', is_income: 1 },
        { id: 2, description: 'COMPANY X', amount: 2000, date: '2024-02-01', is_income: 1 },
        { id: 3, description: 'COMPANY X', amount: 2000, date: '2024-03-01', is_income: 1 },
        { id: 4, description: 'COMPANY X', amount: -50, date: '2024-01-15', is_income: 0 },
        { id: 5, description: 'COMPANY X', amount: -50, date: '2024-02-15', is_income: 0 },
        { id: 6, description: 'COMPANY X', amount: -50, date: '2024-03-15', is_income: 0 },
      ];

      const mockInsertRun = vi.fn().mockReturnValue({ lastInsertRowid: 100 });
      const mockUpdateTx = vi.fn();

      mockDb.prepare.mockImplementation((sql: string) => {
        if (sql.includes('SELECT t.id')) {
          return { all: vi.fn().mockReturnValue(transactions) };
        }
        if (sql.includes('INSERT INTO recurring_patterns')) {
          return { run: mockInsertRun };
        }
        if (sql.includes('SELECT id FROM recurring_patterns')) {
          return { get: vi.fn().mockReturnValue(undefined) };
        }
        if (sql.includes('UPDATE transactions SET recurring_pattern_id')) {
          return { run: mockUpdateTx };
        }
        return { get: vi.fn(), all: vi.fn().mockReturnValue([]), run: vi.fn() };
      });

      const result = detectRecurringPatterns(1);

      // Should detect separate patterns for income and expense
      expect(result.patterns.length).toBe(2);
    });
  });

  describe('deletePattern', () => {
    it('should delete a pattern when user has access', () => {
      const mockGet = vi.fn().mockReturnValue({ id: 1 });
      const mockRun = vi.fn().mockReturnValue({ changes: 1 });

      mockDb.prepare.mockImplementation((sql: string) => {
        if (sql.includes('SELECT rp.id')) {
          return { get: mockGet };
        }
        if (sql.includes('DELETE FROM recurring_patterns')) {
          return { run: mockRun };
        }
        return { get: vi.fn(), run: vi.fn() };
      });

      const result = deletePattern(1, 10);

      expect(result).toBe(true);
      expect(mockRun).toHaveBeenCalledWith(1);
    });

    it('should return false when pattern not found or user has no access', () => {
      mockDb.prepare.mockReturnValue({
        get: vi.fn().mockReturnValue(undefined),
        run: vi.fn(),
      });

      const result = deletePattern(999, 10);

      expect(result).toBe(false);
    });
  });

  describe('getPatternTransactions', () => {
    it('should return transactions linked to a pattern', () => {
      const mockTransactions = [
        {
          id: 1,
          ledger_id: 1,
          date: '2024-01-15',
          description: 'Netflix',
          amount: 12.99,
          balance: 500,
          category_id: 1,
          is_income: 0,
          raw_text: 'NETFLIX',
          created_at: '2024-01-15T00:00:00',
          recurring_pattern_id: 1,
          bank_id: 'test',
          cat_id: 1,
          cat_name: 'Entertainment',
          cat_color: '#FF0000',
          cat_icon: 'tv',
          cat_is_default: 0,
          cat_created_at: '2024-01-01T00:00:00',
        },
      ];

      mockDb.prepare.mockImplementation((sql: string) => {
        if (sql.includes('SELECT id FROM recurring_patterns WHERE id')) {
          return { get: vi.fn().mockReturnValue({ id: 1 }) };
        }
        if (sql.includes('SELECT') && sql.includes('t.recurring_pattern_id')) {
          return { all: vi.fn().mockReturnValue(mockTransactions) };
        }
        return { get: vi.fn(), all: vi.fn().mockReturnValue([]) };
      });

      const result = getPatternTransactions(1, 1);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(1);
      expect(result[0].description).toBe('Netflix');
      expect(result[0].isIncome).toBe(false);
      expect(result[0].category).not.toBeNull();
      expect(result[0].category?.name).toBe('Entertainment');
    });

    it('should throw when pattern not found', () => {
      mockDb.prepare.mockReturnValue({
        get: vi.fn().mockReturnValue(undefined),
        all: vi.fn().mockReturnValue([]),
      });

      expect(() => getPatternTransactions(999, 1)).toThrow('Pattern not found');
    });

    it('should handle transactions without category', () => {
      const mockTransactions = [
        {
          id: 2,
          ledger_id: 1,
          date: '2024-02-15',
          description: 'Payment',
          amount: 50,
          balance: 450,
          category_id: null,
          is_income: 1,
          raw_text: 'PAYMENT',
          created_at: '2024-02-15T00:00:00',
          recurring_pattern_id: 1,
          bank_id: 'test',
          cat_id: null,
          cat_name: null,
          cat_color: null,
          cat_icon: null,
          cat_is_default: null,
          cat_created_at: null,
        },
      ];

      mockDb.prepare.mockImplementation((sql: string) => {
        if (sql.includes('SELECT id FROM recurring_patterns WHERE id')) {
          return { get: vi.fn().mockReturnValue({ id: 1 }) };
        }
        if (sql.includes('SELECT') && sql.includes('t.recurring_pattern_id')) {
          return { all: vi.fn().mockReturnValue(mockTransactions) };
        }
        return { get: vi.fn(), all: vi.fn().mockReturnValue([]) };
      });

      const result = getPatternTransactions(1, 1);

      expect(result[0].category).toBeNull();
      expect(result[0].isIncome).toBe(true);
    });
  });

  describe('updatePattern', () => {
    it('should update pattern fields when user has access', () => {
      const mockGet = vi.fn().mockReturnValue({ id: 1 });
      const mockRun = vi.fn().mockReturnValue({ changes: 1 });

      mockDb.prepare.mockImplementation((sql: string) => {
        if (sql.includes('SELECT rp.id')) {
          return { get: mockGet };
        }
        if (sql.includes('UPDATE recurring_patterns SET')) {
          return { run: mockRun };
        }
        return { get: vi.fn(), run: vi.fn() };
      });

      const result = updatePattern(1, 10, {
        descriptionPattern: 'UPDATED',
        frequency: 'weekly',
        avgAmount: 25.0,
      });

      expect(result).toBe(true);
      expect(mockRun).toHaveBeenCalledWith('UPDATED', 'weekly', 25.0, 1);
    });

    it('should return false when pattern not found or user has no access', () => {
      mockDb.prepare.mockReturnValue({
        get: vi.fn().mockReturnValue(undefined),
        run: vi.fn(),
      });

      const result = updatePattern(999, 10, { descriptionPattern: 'TEST' });

      expect(result).toBe(false);
    });

    it('should handle isActive update', () => {
      const mockGet = vi.fn().mockReturnValue({ id: 1 });
      const mockRun = vi.fn().mockReturnValue({ changes: 1 });

      mockDb.prepare.mockImplementation((sql: string) => {
        if (sql.includes('SELECT rp.id')) {
          return { get: mockGet };
        }
        if (sql.includes('UPDATE recurring_patterns SET')) {
          return { run: mockRun };
        }
        return { get: vi.fn(), run: vi.fn() };
      });

      const result = updatePattern(1, 10, { isActive: false });

      expect(result).toBe(true);
      expect(mockRun).toHaveBeenCalledWith(0, 1);
    });

    it('should return true with no changes when no fields provided', () => {
      const mockGet = vi.fn().mockReturnValue({ id: 1 });

      mockDb.prepare.mockImplementation((sql: string) => {
        if (sql.includes('SELECT rp.id')) {
          return { get: mockGet };
        }
        return { get: vi.fn(), run: vi.fn() };
      });

      const result = updatePattern(1, 10, {});

      expect(result).toBe(true);
    });
  });

  describe('getRecurringSummary', () => {
    it('should return summary of active patterns', () => {
      const mockResult = {
        total_active: 3,
        estimated_monthly_cost: 150.50,
      };

      mockDb.prepare.mockReturnValue({
        get: vi.fn().mockReturnValue(mockResult),
      });

      const result = getRecurringSummary(1);

      expect(result).toEqual({
        totalActive: 3,
        estimatedMonthlyCost: 150.50,
      });
    });

    it('should return zeros when no active patterns', () => {
      const mockResult = {
        total_active: 0,
        estimated_monthly_cost: 0,
      };

      mockDb.prepare.mockReturnValue({
        get: vi.fn().mockReturnValue(mockResult),
      });

      const result = getRecurringSummary(1);

      expect(result).toEqual({
        totalActive: 0,
        estimatedMonthlyCost: 0,
      });
    });
  });
});
