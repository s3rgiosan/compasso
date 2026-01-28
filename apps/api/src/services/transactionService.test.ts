import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the database module
vi.mock('../db/database.js', () => ({
  getDatabase: vi.fn(),
}));

import { getDatabase } from '../db/database.js';
import { AppError } from '../errors.js';
import {
  listTransactions,
  confirmTransactions,
  updateTransactionCategory,
  deleteTransaction,
} from './transactionService.js';

const DEFAULT_WORKSPACE_ID = 1;

describe('transactionService', () => {
  const mockDb = {
    prepare: vi.fn(),
    transaction: vi.fn(),
  };

  beforeEach(() => {
    vi.mocked(getDatabase).mockReturnValue(mockDb as any);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('listTransactions', () => {
    it('should return paginated results with default limit and offset', () => {
      const mockRows = [
        {
          id: 1,
          ledger_id: 1,
          date: '2024-11-15',
          description: 'Grocery Store',
          amount: 50.0,
          balance: 950.0,
          category_id: 1,
          is_income: 0,
          raw_text: 'GROCERY STORE',
          created_at: '2024-11-15T10:00:00',
          recurring_pattern_id: null,
          cat_id: 1,
          cat_name: 'Groceries',
          cat_color: '#4CAF50',
          cat_icon: 'cart',
          cat_is_default: 1,
          cat_created_at: '2024-01-01T00:00:00',
        },
        {
          id: 2,
          ledger_id: 1,
          date: '2024-11-14',
          description: 'Salary',
          amount: 3000.0,
          balance: 4000.0,
          category_id: null,
          is_income: 1,
          raw_text: 'SALARY DEPOSIT',
          created_at: '2024-11-14T09:00:00',
          recurring_pattern_id: null,
          cat_id: null,
          cat_name: null,
          cat_color: null,
          cat_icon: null,
          cat_is_default: null,
          cat_created_at: null,
        },
      ];

      mockDb.prepare.mockImplementation((sql: string) => {
        if (sql.includes('COUNT(*)')) {
          return { get: vi.fn().mockReturnValue({ count: 2 }) };
        }
        return { all: vi.fn().mockReturnValue(mockRows) };
      });

      const result = listTransactions({ workspaceId: DEFAULT_WORKSPACE_ID });

      expect(result.total).toBe(2);
      expect(result.limit).toBe(50);
      expect(result.offset).toBe(0);
      expect(result.items).toHaveLength(2);

      // Verify mapping
      expect(result.items[0].isIncome).toBe(false);
      expect(result.items[0].category).not.toBeNull();
      expect(result.items[0].category?.name).toBe('Groceries');

      expect(result.items[1].isIncome).toBe(true);
      expect(result.items[1].category).toBeNull();
    });

    it('should filter by category', () => {
      let capturedSql = '';
      let capturedParams: unknown[] = [];

      mockDb.prepare.mockImplementation((sql: string) => {
        capturedSql = sql;
        if (sql.includes('COUNT(*)')) {
          return {
            get: vi.fn((...params: unknown[]) => {
              capturedParams = params;
              return { count: 0 };
            }),
          };
        }
        return { all: vi.fn().mockReturnValue([]) };
      });

      listTransactions({ workspaceId: DEFAULT_WORKSPACE_ID, categoryId: 5 });

      expect(capturedSql).toContain('t.category_id = ?');
      expect(capturedParams).toContain(5);
    });

    it('should filter by search term', () => {
      let capturedSql = '';
      let capturedParams: unknown[] = [];

      mockDb.prepare.mockImplementation((sql: string) => {
        capturedSql = sql;
        if (sql.includes('COUNT(*)')) {
          return {
            get: vi.fn((...params: unknown[]) => {
              capturedParams = params;
              return { count: 0 };
            }),
          };
        }
        return { all: vi.fn().mockReturnValue([]) };
      });

      listTransactions({ workspaceId: DEFAULT_WORKSPACE_ID, search: 'grocery' });

      expect(capturedSql).toContain('t.description LIKE ?');
      expect(capturedParams).toContain('%grocery%');
    });

    it('should filter by year and month with zero-padded month', () => {
      let capturedSql = '';
      let capturedParams: unknown[] = [];

      mockDb.prepare.mockImplementation((sql: string) => {
        capturedSql = sql;
        if (sql.includes('COUNT(*)')) {
          return {
            get: vi.fn((...params: unknown[]) => {
              capturedParams = params;
              return { count: 0 };
            }),
          };
        }
        return { all: vi.fn().mockReturnValue([]) };
      });

      listTransactions({ workspaceId: DEFAULT_WORKSPACE_ID, year: 2024, month: 3 });

      expect(capturedSql).toContain('t.date >= ?');
      expect(capturedSql).toContain('t.date < ?');
      expect(capturedParams).toContain('2024-03-01');
      expect(capturedParams).toContain('2024-04-01');
    });

    it('should filter by income type', () => {
      let capturedSql = '';
      let capturedParams: unknown[] = [];

      mockDb.prepare.mockImplementation((sql: string) => {
        capturedSql = sql;
        if (sql.includes('COUNT(*)')) {
          return {
            get: vi.fn((...params: unknown[]) => {
              capturedParams = params;
              return { count: 0 };
            }),
          };
        }
        return { all: vi.fn().mockReturnValue([]) };
      });

      listTransactions({ workspaceId: DEFAULT_WORKSPACE_ID, isIncome: true });

      expect(capturedSql).toContain('t.is_income = ?');
      expect(capturedParams).toContain(1);
    });

    it('should filter by expense type', () => {
      let capturedParams: unknown[] = [];

      mockDb.prepare.mockImplementation((sql: string) => {
        if (sql.includes('COUNT(*)')) {
          return {
            get: vi.fn((...params: unknown[]) => {
              capturedParams = params;
              return { count: 0 };
            }),
          };
        }
        return { all: vi.fn().mockReturnValue([]) };
      });

      listTransactions({ workspaceId: DEFAULT_WORKSPACE_ID, isIncome: false });

      expect(capturedParams).toContain(0);
    });

    it('should return empty results when no transactions match', () => {
      mockDb.prepare.mockImplementation((sql: string) => {
        if (sql.includes('COUNT(*)')) {
          return { get: vi.fn().mockReturnValue({ count: 0 }) };
        }
        return { all: vi.fn().mockReturnValue([]) };
      });

      const result = listTransactions({ workspaceId: DEFAULT_WORKSPACE_ID });

      expect(result.items).toEqual([]);
      expect(result.total).toBe(0);
      expect(result.limit).toBe(50);
      expect(result.offset).toBe(0);
    });

    it('should use custom limit and offset', () => {
      let capturedAllParams: unknown[] = [];

      mockDb.prepare.mockImplementation((sql: string) => {
        if (sql.includes('COUNT(*)')) {
          return { get: vi.fn().mockReturnValue({ count: 100 }) };
        }
        return {
          all: vi.fn((...params: unknown[]) => {
            capturedAllParams = params;
            return [];
          }),
        };
      });

      const result = listTransactions({
        workspaceId: DEFAULT_WORKSPACE_ID,
        limit: 10,
        offset: 20,
      });

      expect(result.limit).toBe(10);
      expect(result.offset).toBe(20);
      // The last two params of the SELECT query should be limit and offset
      expect(capturedAllParams).toContain(10);
      expect(capturedAllParams).toContain(20);
    });
  });

  describe('confirmTransactions', () => {
    it('should insert transactions and return count', () => {
      const transactions = [
        {
          date: '2024-11-15',
          description: 'Test Transaction 1',
          amount: 100,
          balance: 1000,
          categoryId: 1,
          isIncome: false,
          rawText: 'RAW TEXT 1',
        },
        {
          date: '2024-11-16',
          description: 'Test Transaction 2',
          amount: 200,
          balance: 800,
          categoryId: 2,
          isIncome: true,
          rawText: 'RAW TEXT 2',
        },
      ];

      const mockRun = vi.fn();
      mockDb.prepare.mockImplementation((sql: string) => {
        if (sql.includes('SELECT id FROM ledgers')) {
          return { get: vi.fn().mockReturnValue({ id: 1 }) };
        }
        if (sql.includes('INSERT INTO transactions')) {
          return { run: mockRun };
        }
        return { get: vi.fn(), run: vi.fn() };
      });

      mockDb.transaction.mockImplementation((fn) => fn);

      const result = confirmTransactions(1, transactions as any);

      expect(result).toBe(2);
      expect(mockRun).toHaveBeenCalledTimes(2);
    });

    it('should throw bad request when ledgerId is missing', () => {
      expect(() => confirmTransactions(0, [] as any)).toThrow(AppError);
      expect(() => confirmTransactions(0, [] as any)).toThrow(
        'Invalid request: ledgerId and transactions array required'
      );
    });

    it('should throw bad request when transactions is not provided', () => {
      expect(() => confirmTransactions(1, undefined as any)).toThrow(AppError);
      expect(() => confirmTransactions(1, undefined as any)).toThrow(
        'Invalid request: ledgerId and transactions array required'
      );
    });

    it('should throw not found when ledger does not exist', () => {
      mockDb.prepare.mockImplementation((sql: string) => {
        if (sql.includes('SELECT id FROM ledgers')) {
          return { get: vi.fn().mockReturnValue(undefined) };
        }
        return { get: vi.fn(), run: vi.fn() };
      });

      expect(() => confirmTransactions(999, [] as any)).toThrow(AppError);
      expect(() => confirmTransactions(999, [] as any)).toThrow('Ledger not found');
    });

    it('should handle empty transactions array', () => {
      const mockRun = vi.fn();
      mockDb.prepare.mockImplementation((sql: string) => {
        if (sql.includes('SELECT id FROM ledgers')) {
          return { get: vi.fn().mockReturnValue({ id: 1 }) };
        }
        if (sql.includes('INSERT INTO transactions')) {
          return { run: mockRun };
        }
        return { get: vi.fn(), run: vi.fn() };
      });

      mockDb.transaction.mockImplementation((fn) => fn);

      const result = confirmTransactions(1, []);

      expect(result).toBe(0);
      expect(mockRun).not.toHaveBeenCalled();
    });
  });

  describe('updateTransactionCategory', () => {
    it('should update category and set is_manual flag', () => {
      let capturedSql = '';
      let capturedParams: unknown[] = [];

      mockDb.prepare.mockImplementation((sql: string) => {
        capturedSql = sql;
        return {
          run: vi.fn((...params: unknown[]) => {
            capturedParams = params;
            return { changes: 1 };
          }),
        };
      });

      updateTransactionCategory(1, 5, DEFAULT_WORKSPACE_ID);

      expect(capturedSql).toContain('SET category_id = ?, is_manual = 1');
      expect(capturedParams[0]).toBe(5); // categoryId
      expect(capturedParams[1]).toBe(1); // transactionId
      expect(capturedParams[2]).toBe(DEFAULT_WORKSPACE_ID); // workspaceId
    });

    it('should throw bad request when workspaceId is missing', () => {
      expect(() => updateTransactionCategory(1, 5, 0)).toThrow(AppError);
      expect(() => updateTransactionCategory(1, 5, 0)).toThrow('workspaceId is required');
    });

    it('should throw not found when transaction does not exist', () => {
      mockDb.prepare.mockReturnValue({
        run: vi.fn().mockReturnValue({ changes: 0 }),
      });

      expect(() => updateTransactionCategory(999, 5, DEFAULT_WORKSPACE_ID)).toThrow(AppError);
      expect(() => updateTransactionCategory(999, 5, DEFAULT_WORKSPACE_ID)).toThrow(
        'Transaction not found'
      );
    });
  });

  describe('deleteTransaction', () => {
    it('should delete transaction when user has access', () => {
      const mockRun = vi.fn();

      mockDb.prepare.mockImplementation((sql: string) => {
        if (sql.includes('SELECT t.id')) {
          return { get: vi.fn().mockReturnValue({ id: 1 }) };
        }
        if (sql.includes('DELETE FROM transactions')) {
          return { run: mockRun };
        }
        return { get: vi.fn(), run: vi.fn() };
      });

      deleteTransaction(1, 1);

      expect(mockRun).toHaveBeenCalledWith(1);
    });

    it('should throw bad request for invalid transaction ID', () => {
      expect(() => deleteTransaction(NaN, 1)).toThrow(AppError);
      expect(() => deleteTransaction(NaN, 1)).toThrow('Invalid transaction ID');
    });

    it('should throw not found when transaction does not exist or user has no access', () => {
      mockDb.prepare.mockImplementation((sql: string) => {
        if (sql.includes('SELECT t.id')) {
          return { get: vi.fn().mockReturnValue(undefined) };
        }
        return { get: vi.fn(), run: vi.fn() };
      });

      expect(() => deleteTransaction(999, 1)).toThrow(AppError);
      expect(() => deleteTransaction(999, 1)).toThrow('Transaction not found');
    });
  });
});
