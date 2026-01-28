import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../db/database.js', () => ({ getDatabase: vi.fn() }));
vi.mock('../parsers/registry.js', () => ({
  BANK_CONFIGS: {
    novo_banco: {
      id: 'novo_banco',
      name: 'Novo Banco',
      country: 'PT',
      currency: 'EUR',
      dateFormat: 'DD.MM.YY',
      decimalFormat: 'european',
    },
  },
  getParser: vi.fn(),
}));
vi.mock('./categoryMatcher.js', () => ({
  applyCategorySuggestions: vi.fn(),
}));

import { getDatabase } from '../db/database.js';
import { getParser } from '../parsers/registry.js';
import { applyCategorySuggestions } from './categoryMatcher.js';
import { AppError } from '../errors.js';
import { processUpload, listLedgers, deleteLedger, getLedgerWorkspaceId } from './uploadService.js';

const mockDb = { prepare: vi.fn() };

beforeEach(() => {
  vi.mocked(getDatabase).mockReturnValue(mockDb as any);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('processUpload', () => {
  const buffer = Buffer.from('fake-pdf-content');
  const filename = 'statement.pdf';
  const bankId = 'novo_banco';
  const workspaceId = 1;

  const parseResult = {
    fileHash: 'abc123hash',
    periodStart: '2024-01-01',
    periodEnd: '2024-01-31',
    transactions: [
      { date: '2024-01-15', description: 'Test Transaction', amount: 100, type: 'credit' },
      { date: '2024-01-20', description: 'Another Transaction', amount: -50, type: 'debit' },
    ],
  };

  const categorizedTransactions = [
    { date: '2024-01-15', description: 'Test Transaction', amount: 100, type: 'credit', categoryId: 1 },
    { date: '2024-01-20', description: 'Another Transaction', amount: -50, type: 'debit', categoryId: 2 },
  ];

  const mockParseFn = vi.fn();

  beforeEach(() => {
    vi.mocked(getParser).mockReturnValue(mockParseFn);
  });

  it('should parse PDF and create a new ledger', async () => {
    mockParseFn.mockResolvedValue(parseResult as any);
    vi.mocked(applyCategorySuggestions).mockReturnValue(categorizedTransactions as any);

    const mockGet = vi.fn().mockReturnValue(undefined);
    const mockRun = vi.fn().mockReturnValue({ lastInsertRowid: 42 });

    mockDb.prepare.mockReturnValue({ get: mockGet, run: mockRun });

    const result = await processUpload(buffer, filename, bankId, workspaceId);

    expect(mockParseFn).toHaveBeenCalledWith(buffer);
    expect(applyCategorySuggestions).toHaveBeenCalledWith(parseResult.transactions, bankId, workspaceId);
    expect(result).toMatchObject({
      ledgerId: 42,
      filename,
      bankId,
      transactionCount: categorizedTransactions.length,
      transactions: categorizedTransactions,
      periodStart: '2024-01-01',
      periodEnd: '2024-01-31',
    });
  });

  it('should delete existing ledger when duplicate file hash is found', async () => {
    mockParseFn.mockResolvedValue(parseResult as any);
    vi.mocked(applyCategorySuggestions).mockReturnValue(categorizedTransactions as any);

    const existingLedger = { id: 10, filename: 'old-statement.pdf' };
    const mockGet = vi.fn().mockReturnValueOnce(existingLedger);
    const mockRun = vi.fn().mockReturnValue({ lastInsertRowid: 43 });

    mockDb.prepare.mockReturnValue({ get: mockGet, run: mockRun });

    const result = await processUpload(buffer, filename, bankId, workspaceId);

    expect(mockParseFn).toHaveBeenCalledWith(buffer);
    expect(result.ledgerId).toBe(43);
    // The duplicate check query should have been prepared
    expect(mockDb.prepare).toHaveBeenCalledWith(
      expect.stringContaining('SELECT id, filename FROM ledgers WHERE file_hash'),
    );
    // A DELETE should have been issued for the old ledger
    expect(mockRun).toHaveBeenCalled();
  });

  it('should throw AppError for unsupported bank ID', async () => {
    vi.mocked(getParser).mockReturnValue(undefined);

    await expect(processUpload(buffer, filename, 'unknown_bank', workspaceId)).rejects.toThrow(AppError);
    await expect(processUpload(buffer, filename, 'unknown_bank', workspaceId)).rejects.toThrow(
      /Unsupported bank/,
    );
  });

  it('should throw AppError for bank without parser implementation', async () => {
    vi.mocked(getParser).mockReturnValue(undefined);

    await expect(processUpload(buffer, filename, 'unknown_bank', workspaceId)).rejects.toThrow(AppError);
  });

  it('should pass the correct workspace ID to the duplicate check query', async () => {
    mockParseFn.mockResolvedValue(parseResult as any);
    vi.mocked(applyCategorySuggestions).mockReturnValue(categorizedTransactions as any);

    const mockGet = vi.fn().mockReturnValue(undefined);
    const mockRun = vi.fn().mockReturnValue({ lastInsertRowid: 44 });

    mockDb.prepare.mockReturnValue({ get: mockGet, run: mockRun });

    await processUpload(buffer, filename, bankId, workspaceId);

    // The duplicate check uses positional args: (fileHash, workspaceId)
    expect(mockGet).toHaveBeenCalledWith(parseResult.fileHash, workspaceId);
  });

  it('should call applyCategorySuggestions with parsed transactions, bankId, and workspaceId', async () => {
    mockParseFn.mockResolvedValue(parseResult as any);
    vi.mocked(applyCategorySuggestions).mockReturnValue(categorizedTransactions as any);

    const mockGet = vi.fn().mockReturnValue(undefined);
    const mockRun = vi.fn().mockReturnValue({ lastInsertRowid: 45 });

    mockDb.prepare.mockReturnValue({ get: mockGet, run: mockRun });

    await processUpload(buffer, filename, bankId, workspaceId);

    expect(applyCategorySuggestions).toHaveBeenCalledWith(parseResult.transactions, bankId, workspaceId);
  });

  it('should return the correct transaction count', async () => {
    mockParseFn.mockResolvedValue(parseResult as any);
    vi.mocked(applyCategorySuggestions).mockReturnValue(categorizedTransactions as any);

    const mockGet = vi.fn().mockReturnValue(undefined);
    const mockRun = vi.fn().mockReturnValue({ lastInsertRowid: 46 });

    mockDb.prepare.mockReturnValue({ get: mockGet, run: mockRun });

    const result = await processUpload(buffer, filename, bankId, workspaceId);

    expect(result.transactionCount).toBe(2);
  });
});

describe('listLedgers', () => {
  it('should return paginated ledger list with transaction counts', () => {
    const mockRows = [
      {
        id: 1,
        filename: 'jan.pdf',
        bank_id: 'novo_banco',
        upload_date: '2024-01-15T10:00:00Z',
        period_start: '2024-01-01',
        period_end: '2024-01-31',
        transaction_count: 25,
      },
      {
        id: 2,
        filename: 'feb.pdf',
        bank_id: 'novo_banco',
        upload_date: '2024-02-15T10:00:00Z',
        period_start: '2024-02-01',
        period_end: '2024-02-29',
        transaction_count: 30,
      },
    ];

    const mockGet = vi.fn().mockReturnValue({ count: 5 });
    const mockAll = vi.fn().mockReturnValue(mockRows);

    mockDb.prepare.mockReturnValue({ get: mockGet, all: mockAll });

    const result = listLedgers(1, 10, 0);

    expect(result.total).toBe(5);
    expect(result.limit).toBe(10);
    expect(result.offset).toBe(0);
    expect(result.items).toHaveLength(2);
    expect(result.items[0]).toMatchObject({
      id: 1,
      filename: 'jan.pdf',
      bankId: 'novo_banco',
      uploadDate: '2024-01-15T10:00:00Z',
      periodStart: '2024-01-01',
      periodEnd: '2024-01-31',
      transactionCount: 25,
    });
  });

  it('should return empty items when no ledgers exist', () => {
    const mockGet = vi.fn().mockReturnValue({ count: 0 });
    const mockAll = vi.fn().mockReturnValue([]);

    mockDb.prepare.mockReturnValue({ get: mockGet, all: mockAll });

    const result = listLedgers(1, 10, 0);

    expect(result.total).toBe(0);
    expect(result.items).toHaveLength(0);
    expect(result.limit).toBe(10);
    expect(result.offset).toBe(0);
  });

  it('should pass limit and offset to the query', () => {
    const mockGet = vi.fn().mockReturnValue({ count: 20 });
    const mockAll = vi.fn().mockReturnValue([]);

    mockDb.prepare.mockReturnValue({ get: mockGet, all: mockAll });

    const result = listLedgers(1, 5, 10);

    expect(result.limit).toBe(5);
    expect(result.offset).toBe(10);
    expect(mockAll).toHaveBeenCalled();
  });

  it('should map database columns to camelCase properties', () => {
    const mockRow = {
      id: 3,
      filename: 'march.pdf',
      bank_id: 'novo_banco',
      upload_date: '2024-03-15T10:00:00Z',
      period_start: '2024-03-01',
      period_end: '2024-03-31',
      transaction_count: 15,
    };

    const mockGet = vi.fn().mockReturnValue({ count: 1 });
    const mockAll = vi.fn().mockReturnValue([mockRow]);

    mockDb.prepare.mockReturnValue({ get: mockGet, all: mockAll });

    const result = listLedgers(1, 10, 0);
    const item = result.items[0];

    expect(item).toHaveProperty('bankId');
    expect(item).toHaveProperty('uploadDate');
    expect(item).toHaveProperty('periodStart');
    expect(item).toHaveProperty('periodEnd');
    expect(item).toHaveProperty('transactionCount');
    expect(item).not.toHaveProperty('bank_id');
    expect(item).not.toHaveProperty('upload_date');
    expect(item).not.toHaveProperty('period_start');
    expect(item).not.toHaveProperty('period_end');
    expect(item).not.toHaveProperty('transaction_count');
  });
});

describe('deleteLedger', () => {
  it('should delete a ledger when user has access', () => {
    const mockLedger = { id: 1, workspace_id: 1 };
    const mockGet = vi.fn().mockReturnValue(mockLedger);
    const mockRun = vi.fn();

    mockDb.prepare.mockReturnValue({ get: mockGet, run: mockRun });

    expect(() => deleteLedger(1, 100)).not.toThrow();
    expect(mockRun).toHaveBeenCalled();
  });

  it('should throw AppError not found when ledger does not exist', () => {
    const mockGet = vi.fn().mockReturnValue(undefined);

    mockDb.prepare.mockReturnValue({ get: mockGet });

    expect(() => deleteLedger(1, 100)).toThrow(AppError);
    expect(() => deleteLedger(1, 100)).toThrow(/not found/i);
  });

  it('should throw AppError bad request when ledger ID is NaN', () => {
    expect(() => deleteLedger(NaN, 100)).toThrow(AppError);
    expect(() => deleteLedger(NaN, 100)).toThrow(/Invalid ledger ID/);
  });

  it('should verify user access via workspace_members join', () => {
    const mockLedger = { id: 5, workspace_id: 2 };
    const mockGet = vi.fn().mockReturnValue(mockLedger);
    const mockRun = vi.fn();

    mockDb.prepare.mockReturnValue({ get: mockGet, run: mockRun });

    deleteLedger(5, 200);

    expect(mockDb.prepare).toHaveBeenCalledWith(expect.stringContaining('workspace_members'));
  });

  it('should prepare a DELETE query for the ledger', () => {
    const mockLedger = { id: 7, workspace_id: 3 };
    const mockGet = vi.fn().mockReturnValue(mockLedger);
    const mockRun = vi.fn();

    mockDb.prepare.mockReturnValue({ get: mockGet, run: mockRun });

    deleteLedger(7, 300);

    expect(mockDb.prepare).toHaveBeenCalledWith(expect.stringContaining('DELETE'));
  });
});

describe('getLedgerWorkspaceId', () => {
  it('should return the workspace_id for a given ledger', () => {
    const mockGet = vi.fn().mockReturnValue({ workspace_id: 5 });
    mockDb.prepare.mockReturnValue({ get: mockGet });

    const result = getLedgerWorkspaceId(1);

    expect(result).toBe(5);
    expect(mockGet).toHaveBeenCalledWith(1);
  });

  it('should throw AppError not found when ledger does not exist', () => {
    const mockGet = vi.fn().mockReturnValue(undefined);
    mockDb.prepare.mockReturnValue({ get: mockGet });

    expect(() => getLedgerWorkspaceId(999)).toThrow(AppError);
    expect(() => getLedgerWorkspaceId(999)).toThrow(/not found/i);
  });
});
