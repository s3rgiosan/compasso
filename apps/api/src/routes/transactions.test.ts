import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { createTestApp, TEST_USER } from './test-helpers.js';
import { AppError } from '../errors.js';

vi.mock('../middleware/auth.js', () => ({
  authMiddleware: vi.fn((_req: any, _res: any, next: any) => {
    _req.user = TEST_USER;
    _req.sessionId = 'test-session-id';
    next();
  }),
}));

vi.mock('../services/transactionService.js', () => ({
  listTransactions: vi.fn(),
  exportTransactions: vi.fn(),
  confirmTransactions: vi.fn(),
  updateTransactionCategory: vi.fn(),
  deleteTransaction: vi.fn(),
}));

vi.mock('../services/workspaceService.js', () => ({
  requireWorkspaceMembership: vi.fn(),
}));

vi.mock('../services/uploadService.js', () => ({
  getLedgerWorkspaceId: vi.fn(),
}));

import router from './transactions.js';
import {
  listTransactions,
  exportTransactions,
  confirmTransactions,
  updateTransactionCategory,
  deleteTransaction,
} from '../services/transactionService.js';
import { requireWorkspaceMembership } from '../services/workspaceService.js';
import { getLedgerWorkspaceId } from '../services/uploadService.js';

const app = createTestApp(router, '/api/transactions');

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/transactions', () => {
  it('returns 200 with transactions', async () => {
    const result = { items: [{ id: 1 }], total: 1 };
    vi.mocked(listTransactions).mockReturnValue(result as any);

    const res = await request(app).get('/api/transactions?workspaceId=1');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, data: result });
  });

  it('returns 400 when workspaceId is missing', async () => {
    const res = await request(app).get('/api/transactions');

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('checks workspace membership', async () => {
    vi.mocked(listTransactions).mockReturnValue({ items: [], total: 0 } as any);

    await request(app).get('/api/transactions?workspaceId=1');

    expect(requireWorkspaceMembership).toHaveBeenCalledWith(1, TEST_USER.id);
  });

  it('parses isIncome string to boolean true', async () => {
    vi.mocked(listTransactions).mockReturnValue({ items: [], total: 0 } as any);

    await request(app).get('/api/transactions?workspaceId=1&isIncome=true');

    expect(listTransactions).toHaveBeenCalledWith(
      expect.objectContaining({ isIncome: true }),
    );
  });

  it('parses isIncome string to boolean false', async () => {
    vi.mocked(listTransactions).mockReturnValue({ items: [], total: 0 } as any);

    await request(app).get('/api/transactions?workspaceId=1&isIncome=false');

    expect(listTransactions).toHaveBeenCalledWith(
      expect.objectContaining({ isIncome: false }),
    );
  });

  it('passes all optional params', async () => {
    vi.mocked(listTransactions).mockReturnValue({ items: [], total: 0 } as any);

    await request(app).get(
      '/api/transactions?workspaceId=1&year=2024&month=6&categoryId=3&search=coffee&limit=10&offset=20',
    );

    expect(listTransactions).toHaveBeenCalledWith({
      workspaceId: 1,
      year: 2024,
      month: 6,
      categoryId: 3,
      isIncome: undefined,
      search: 'coffee',
      limit: 10,
      offset: 20,
    });
  });

  it('passes undefined for omitted optional params', async () => {
    vi.mocked(listTransactions).mockReturnValue({ items: [], total: 0 } as any);

    await request(app).get('/api/transactions?workspaceId=1');

    expect(listTransactions).toHaveBeenCalledWith({
      workspaceId: 1,
      year: undefined,
      month: undefined,
      categoryId: undefined,
      isIncome: undefined,
      search: undefined,
      limit: undefined,
      offset: undefined,
    });
  });
});

describe('GET /api/transactions/export', () => {
  it('returns CSV with correct headers and content-type', async () => {
    vi.mocked(exportTransactions).mockReturnValue([
      { date: '2024-01-15', description: 'Coffee Shop', isIncome: false, amount: 3.50, categoryName: 'Food', balance: 100.00 },
      { date: '2024-01-16', description: 'Salary', isIncome: true, amount: 2000, categoryName: 'Income', balance: 2100.00 },
    ]);

    const res = await request(app).get('/api/transactions/export?workspaceId=1');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/csv/);
    expect(res.headers['content-disposition']).toMatch(/attachment; filename="compasso-transactions-.*\.csv"/);

    const lines = res.text.replace('\uFEFF', '').split('\r\n');
    expect(lines[0]).toBe('Date,Description,Type,Amount,Category,Balance');
    expect(lines[1]).toBe('2024-01-15,Coffee Shop,Expense,-3.50,Food,100.00');
    expect(lines[2]).toBe('2024-01-16,Salary,Income,2000.00,Income,2100.00');
  });

  it('escapes CSV fields with commas', async () => {
    vi.mocked(exportTransactions).mockReturnValue([
      { date: '2024-01-15', description: 'Coffee, Tea & More', isIncome: false, amount: 5, categoryName: 'Food', balance: null },
    ]);

    const res = await request(app).get('/api/transactions/export?workspaceId=1');

    const lines = res.text.replace('\uFEFF', '').split('\r\n');
    expect(lines[1]).toBe('2024-01-15,"Coffee, Tea & More",Expense,-5.00,Food,');
  });

  it('passes filters to exportTransactions', async () => {
    vi.mocked(exportTransactions).mockReturnValue([]);

    await request(app).get(
      '/api/transactions/export?workspaceId=1&year=2024&month=6&categoryId=3&isIncome=true&search=coffee',
    );

    expect(exportTransactions).toHaveBeenCalledWith({
      workspaceId: 1,
      year: 2024,
      month: 6,
      categoryId: 3,
      isIncome: true,
      search: 'coffee',
    });
  });

  it('returns 400 when workspaceId is missing', async () => {
    const res = await request(app).get('/api/transactions/export');

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('checks workspace membership', async () => {
    vi.mocked(exportTransactions).mockReturnValue([]);

    await request(app).get('/api/transactions/export?workspaceId=2');

    expect(requireWorkspaceMembership).toHaveBeenCalledWith(2, TEST_USER.id);
  });
});

describe('POST /api/transactions/confirm', () => {
  beforeEach(() => {
    vi.mocked(getLedgerWorkspaceId).mockReturnValue(1);
  });

  it('returns 200 with count', async () => {
    vi.mocked(confirmTransactions).mockReturnValue(5 as any);

    const res = await request(app)
      .post('/api/transactions/confirm')
      .send({
        ledgerId: 1,
        transactions: [
          { date: '2024-01-01', description: 'Test 1', amount: 10, isIncome: false },
          { date: '2024-01-02', description: 'Test 2', amount: 20, isIncome: true },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, data: { count: 5 } });
  });

  it('passes ledgerId and transactions to service', async () => {
    vi.mocked(confirmTransactions).mockReturnValue(0 as any);
    const transactions = [
      { date: '2024-01-01', description: 'Coffee', amount: 5, isIncome: false, categoryId: 2 },
    ];

    await request(app)
      .post('/api/transactions/confirm')
      .send({ ledgerId: 10, transactions });

    expect(confirmTransactions).toHaveBeenCalledWith(10, transactions);
  });

  it('checks workspace membership via ledger', async () => {
    vi.mocked(getLedgerWorkspaceId).mockReturnValue(5);
    vi.mocked(confirmTransactions).mockReturnValue(0 as any);

    await request(app)
      .post('/api/transactions/confirm')
      .send({ ledgerId: 10, transactions: [{ date: '2024-01-01', description: 'T', amount: 1, isIncome: false }] });

    expect(getLedgerWorkspaceId).toHaveBeenCalledWith(10);
    expect(requireWorkspaceMembership).toHaveBeenCalledWith(5, TEST_USER.id);
  });
});

describe('PUT /api/transactions/:id', () => {
  it('returns 200 on success', async () => {
    vi.mocked(updateTransactionCategory).mockReturnValue(undefined as any);

    const res = await request(app)
      .put('/api/transactions/1')
      .send({ categoryId: 5, workspaceId: 1 });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true });
  });

  it('passes id, categoryId, and workspaceId to service', async () => {
    vi.mocked(updateTransactionCategory).mockReturnValue(undefined as any);

    await request(app)
      .put('/api/transactions/42')
      .send({ categoryId: 7, workspaceId: 3 });

    expect(updateTransactionCategory).toHaveBeenCalledWith(42, 7, 3);
  });

  it('checks workspace membership', async () => {
    vi.mocked(updateTransactionCategory).mockReturnValue(undefined as any);

    await request(app)
      .put('/api/transactions/1')
      .send({ categoryId: 5, workspaceId: 3 });

    expect(requireWorkspaceMembership).toHaveBeenCalledWith(3, TEST_USER.id);
  });
});

describe('DELETE /api/transactions/:id', () => {
  it('returns 200 on success', async () => {
    vi.mocked(deleteTransaction).mockReturnValue(undefined as any);

    const res = await request(app).delete('/api/transactions/1?workspaceId=1');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true });
  });

  it('returns 400 when workspaceId is missing', async () => {
    const res = await request(app).delete('/api/transactions/1');

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('passes id and user.id to service', async () => {
    vi.mocked(deleteTransaction).mockReturnValue(undefined as any);

    await request(app).delete('/api/transactions/42?workspaceId=1');

    expect(deleteTransaction).toHaveBeenCalledWith(42, TEST_USER.id);
  });

  it('checks workspace membership', async () => {
    vi.mocked(deleteTransaction).mockReturnValue(undefined as any);

    await request(app).delete('/api/transactions/1?workspaceId=3');

    expect(requireWorkspaceMembership).toHaveBeenCalledWith(3, TEST_USER.id);
  });

  it('propagates not-found error', async () => {
    vi.mocked(deleteTransaction).mockImplementation(() => {
      throw AppError.notFound('Transaction not found');
    });

    const res = await request(app).delete('/api/transactions/999?workspaceId=1');

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });
});
