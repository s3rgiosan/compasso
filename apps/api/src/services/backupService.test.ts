import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../db/database.js', () => ({ getDatabase: vi.fn() }));

import { getDatabase } from '../db/database.js';
import { exportWorkspaceData, importWorkspaceData, type WorkspaceBackup } from './backupService.js';

const mockDb: any = { prepare: vi.fn(), transaction: vi.fn((fn: any) => fn) };

beforeEach(() => {
  vi.mocked(getDatabase).mockReturnValue(mockDb as any);
});

afterEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Helper: build a minimal valid backup
// ---------------------------------------------------------------------------
function makeBackup(overrides: Partial<WorkspaceBackup> = {}): WorkspaceBackup {
  return {
    version: 1,
    exportedAt: '2024-06-01T00:00:00.000Z',
    workspace: { name: 'W', description: null, color: '#000', icon: 'star' },
    categories: [],
    ledgers: [],
    recurringPatterns: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// exportWorkspaceData
// ---------------------------------------------------------------------------
describe('exportWorkspaceData', () => {
  it('exports workspace metadata', () => {
    const workspace = { name: 'My Workspace', description: 'desc', color: '#112233', icon: 'wallet' };

    mockDb.prepare.mockImplementation((sql: string) => {
      if (sql.includes('FROM workspaces')) return { get: vi.fn().mockReturnValue(workspace) };
      if (sql.includes('FROM categories WHERE workspace_id')) return { all: vi.fn().mockReturnValue([]) };
      if (sql.includes('FROM ledgers WHERE workspace_id')) return { all: vi.fn().mockReturnValue([]) };
      if (sql.includes('FROM recurring_patterns WHERE workspace_id')) return { all: vi.fn().mockReturnValue([]) };
      return { all: vi.fn().mockReturnValue([]), get: vi.fn() };
    });

    const result = exportWorkspaceData(1);

    expect(result.workspace).toEqual({
      name: 'My Workspace',
      description: 'desc',
      color: '#112233',
      icon: 'wallet',
    });
  });

  it('exports categories with patterns', () => {
    const categories = [
      { id: 10, name: 'Food', color: '#ff0000', icon: 'utensils', is_default: 1 },
    ];
    const patterns = [
      { bank_id: 'novo_banco', pattern: 'GROCERIES', priority: 0, category_id: 10 },
    ];
    const workspace = { name: 'W', description: null, color: '#000', icon: 'star' };

    mockDb.prepare.mockImplementation((sql: string) => {
      if (sql.includes('FROM workspaces')) return { get: vi.fn().mockReturnValue(workspace) };
      if (sql.includes('FROM categories WHERE workspace_id')) return { all: vi.fn().mockReturnValue(categories) };
      if (sql.includes('FROM category_patterns')) return { all: vi.fn().mockReturnValue(patterns) };
      if (sql.includes('FROM ledgers WHERE workspace_id')) return { all: vi.fn().mockReturnValue([]) };
      if (sql.includes('FROM transactions t')) return { all: vi.fn().mockReturnValue([]) };
      if (sql.includes('FROM recurring_patterns WHERE workspace_id')) return { all: vi.fn().mockReturnValue([]) };
      return { all: vi.fn().mockReturnValue([]), get: vi.fn() };
    });

    const result = exportWorkspaceData(1);

    expect(result.categories).toHaveLength(1);
    expect(result.categories[0]).toEqual({
      name: 'Food',
      color: '#ff0000',
      icon: 'utensils',
      isDefault: true,
      patterns: [{ bankId: 'novo_banco', pattern: 'GROCERIES', priority: 0 }],
    });
  });

  it('exports ledgers with transactions', () => {
    const workspace = { name: 'W', description: null, color: '#000', icon: 'star' };
    const ledgers = [
      { id: 5, filename: 'jan.pdf', upload_date: '2024-01-15', period_start: '2024-01-01', period_end: '2024-01-31', bank_id: 'novo_banco', file_hash: 'abc123' },
    ];
    const transactions = [
      { ledger_id: 5, date: '2024-01-10', description: 'Shop', amount: -50, balance: 1000, category_name: 'Food', is_income: 0, is_manual: 0, raw_text: 'SHOP RAW' },
      { ledger_id: 5, date: '2024-01-12', description: 'Salary', amount: 2000, balance: 3000, category_name: 'Income', is_income: 1, is_manual: 1, raw_text: null },
    ];

    mockDb.prepare.mockImplementation((sql: string) => {
      if (sql.includes('FROM workspaces')) return { get: vi.fn().mockReturnValue(workspace) };
      if (sql.includes('FROM categories WHERE workspace_id')) return { all: vi.fn().mockReturnValue([]) };
      if (sql.includes('FROM category_patterns')) return { all: vi.fn().mockReturnValue([]) };
      if (sql.includes('FROM ledgers WHERE workspace_id')) return { all: vi.fn().mockReturnValue(ledgers) };
      if (sql.includes('FROM transactions t')) return { all: vi.fn().mockReturnValue(transactions) };
      if (sql.includes('FROM recurring_patterns WHERE workspace_id')) return { all: vi.fn().mockReturnValue([]) };
      return { all: vi.fn().mockReturnValue([]), get: vi.fn() };
    });

    const result = exportWorkspaceData(1);

    expect(result.ledgers).toHaveLength(1);
    expect(result.ledgers[0].filename).toBe('jan.pdf');
    expect(result.ledgers[0].fileHash).toBe('abc123');
    expect(result.ledgers[0].transactions).toHaveLength(2);
    expect(result.ledgers[0].transactions[0]).toEqual({
      date: '2024-01-10',
      description: 'Shop',
      amount: -50,
      balance: 1000,
      categoryName: 'Food',
      isIncome: false,
      isManual: false,
      rawText: 'SHOP RAW',
    });
    expect(result.ledgers[0].transactions[1].isIncome).toBe(true);
    expect(result.ledgers[0].transactions[1].isManual).toBe(true);
  });

  it('exports recurring patterns', () => {
    const workspace = { name: 'W', description: null, color: '#000', icon: 'star' };
    const recurring = [
      { description_pattern: 'NETFLIX', frequency: 'monthly', avg_amount: 15.99, occurrence_count: 6, is_active: 1 },
      { description_pattern: 'OLD SUB', frequency: 'monthly', avg_amount: 5, occurrence_count: 2, is_active: 0 },
    ];

    mockDb.prepare.mockImplementation((sql: string) => {
      if (sql.includes('FROM workspaces')) return { get: vi.fn().mockReturnValue(workspace) };
      if (sql.includes('FROM categories WHERE workspace_id')) return { all: vi.fn().mockReturnValue([]) };
      if (sql.includes('FROM ledgers WHERE workspace_id')) return { all: vi.fn().mockReturnValue([]) };
      if (sql.includes('FROM recurring_patterns WHERE workspace_id')) return { all: vi.fn().mockReturnValue(recurring) };
      return { all: vi.fn().mockReturnValue([]), get: vi.fn() };
    });

    const result = exportWorkspaceData(1);

    expect(result.recurringPatterns).toHaveLength(2);
    expect(result.recurringPatterns[0]).toEqual({
      descriptionPattern: 'NETFLIX',
      frequency: 'monthly',
      avgAmount: 15.99,
      occurrenceCount: 6,
      isActive: true,
    });
    expect(result.recurringPatterns[1].isActive).toBe(false);
  });

  it('sets version and exportedAt', () => {
    const workspace = { name: 'W', description: null, color: '#000', icon: 'star' };

    mockDb.prepare.mockImplementation((sql: string) => {
      if (sql.includes('FROM workspaces')) return { get: vi.fn().mockReturnValue(workspace) };
      if (sql.includes('FROM categories WHERE workspace_id')) return { all: vi.fn().mockReturnValue([]) };
      if (sql.includes('FROM ledgers WHERE workspace_id')) return { all: vi.fn().mockReturnValue([]) };
      if (sql.includes('FROM recurring_patterns WHERE workspace_id')) return { all: vi.fn().mockReturnValue([]) };
      return { all: vi.fn().mockReturnValue([]), get: vi.fn() };
    });

    const result = exportWorkspaceData(1);

    expect(result.version).toBe(1);
    expect(() => new Date(result.exportedAt).toISOString()).not.toThrow();
  });

  it('handles empty workspace', () => {
    const workspace = { name: 'Empty', description: null, color: '#000', icon: 'star' };

    mockDb.prepare.mockImplementation((sql: string) => {
      if (sql.includes('FROM workspaces')) return { get: vi.fn().mockReturnValue(workspace) };
      if (sql.includes('FROM categories WHERE workspace_id')) return { all: vi.fn().mockReturnValue([]) };
      if (sql.includes('FROM ledgers WHERE workspace_id')) return { all: vi.fn().mockReturnValue([]) };
      if (sql.includes('FROM recurring_patterns WHERE workspace_id')) return { all: vi.fn().mockReturnValue([]) };
      return { all: vi.fn().mockReturnValue([]), get: vi.fn() };
    });

    const result = exportWorkspaceData(1);

    expect(result.categories).toEqual([]);
    expect(result.ledgers).toEqual([]);
    expect(result.recurringPatterns).toEqual([]);
  });

  it('handles transactions with null category', () => {
    const workspace = { name: 'W', description: null, color: '#000', icon: 'star' };
    const ledgers = [
      { id: 1, filename: 'f.pdf', upload_date: '2024-01-01', period_start: null, period_end: null, bank_id: 'novo_banco', file_hash: null },
    ];
    const transactions = [
      { ledger_id: 1, date: '2024-01-05', description: 'Unknown', amount: -10, balance: null, category_name: null, is_income: 0, is_manual: 0, raw_text: null },
    ];

    mockDb.prepare.mockImplementation((sql: string) => {
      if (sql.includes('FROM workspaces')) return { get: vi.fn().mockReturnValue(workspace) };
      if (sql.includes('FROM categories WHERE workspace_id')) return { all: vi.fn().mockReturnValue([]) };
      if (sql.includes('FROM category_patterns')) return { all: vi.fn().mockReturnValue([]) };
      if (sql.includes('FROM ledgers WHERE workspace_id')) return { all: vi.fn().mockReturnValue(ledgers) };
      if (sql.includes('FROM transactions t')) return { all: vi.fn().mockReturnValue(transactions) };
      if (sql.includes('FROM recurring_patterns WHERE workspace_id')) return { all: vi.fn().mockReturnValue([]) };
      return { all: vi.fn().mockReturnValue([]), get: vi.fn() };
    });

    const result = exportWorkspaceData(1);

    expect(result.ledgers[0].transactions[0].categoryName).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// importWorkspaceData
// ---------------------------------------------------------------------------
describe('importWorkspaceData', () => {
  // Shared mock builders ------------------------------------------------

  /** Returns a mockImplementation router for db.prepare() */
  function prepareMockRouter(overrides: Record<string, any> = {}) {
    const defaults: Record<string, any> = {
      existingCategories: [],           // SELECT id, name FROM categories WHERE workspace_id
      categoryInsert: { lastInsertRowid: 100 }, // INSERT INTO categories
      patternDupCheck: undefined,       // SELECT id FROM category_patterns
      patternInsert: {},                // INSERT INTO category_patterns
      ledgerDupCheck: undefined,        // SELECT id FROM ledgers WHERE file_hash
      ledgerInsert: { lastInsertRowid: 200 },   // INSERT INTO ledgers
      transactionInsert: {},            // INSERT INTO transactions
      recurringDupCheck: undefined,     // SELECT id FROM recurring_patterns
      recurringInsert: {},              // INSERT INTO recurring_patterns
      ...overrides,
    };

    return (sql: string) => {
      // Category patterns (must be checked BEFORE categories — the pattern dup SQL contains a categories subquery)
      if (sql.includes('category_patterns') && sql.includes('pattern = ?'))
        return { get: vi.fn().mockReturnValue(defaults.patternDupCheck) };
      if (sql.includes('INTO category_patterns'))
        return { run: vi.fn().mockReturnValue(defaults.patternInsert) };

      // Categories
      if (sql.includes('FROM categories WHERE workspace_id'))
        return { all: vi.fn().mockReturnValue(defaults.existingCategories) };
      if (sql.includes('INTO categories'))
        return { run: vi.fn().mockReturnValue(defaults.categoryInsert) };

      // Ledgers
      if (sql.includes('SELECT id FROM ledgers WHERE file_hash'))
        return { get: vi.fn().mockReturnValue(defaults.ledgerDupCheck) };
      if (sql.includes('INTO ledgers'))
        return { run: vi.fn().mockReturnValue(defaults.ledgerInsert) };

      // Transactions
      if (sql.includes('INTO transactions'))
        return { run: vi.fn().mockReturnValue(defaults.transactionInsert) };

      // Recurring patterns
      if (sql.includes('SELECT id FROM recurring_patterns'))
        return { get: vi.fn().mockReturnValue(defaults.recurringDupCheck) };
      if (sql.includes('INTO recurring_patterns'))
        return { run: vi.fn().mockReturnValue(defaults.recurringInsert) };

      // Fallback
      return { all: vi.fn().mockReturnValue([]), get: vi.fn(), run: vi.fn() };
    };
  }

  // --- Category import tests ---

  it('imports new categories', () => {
    mockDb.prepare.mockImplementation(prepareMockRouter({
      existingCategories: [],
      categoryInsert: { lastInsertRowid: 50 },
    }));

    const backup = makeBackup({
      categories: [
        { name: 'Food', color: '#f00', icon: 'utensils', isDefault: false, patterns: [] },
      ],
    });

    const stats = importWorkspaceData(1, backup);

    expect(stats.categoriesImported).toBe(1);
    expect(stats.categoriesSkipped).toBe(0);
  });

  it('skips duplicate categories', () => {
    mockDb.prepare.mockImplementation(prepareMockRouter({
      existingCategories: [{ id: 5, name: 'Food' }],
    }));

    const backup = makeBackup({
      categories: [
        { name: 'Food', color: '#f00', icon: 'utensils', isDefault: false, patterns: [] },
      ],
    });

    const stats = importWorkspaceData(1, backup);

    expect(stats.categoriesImported).toBe(0);
    expect(stats.categoriesSkipped).toBe(1);
  });

  it('imports patterns for new categories', () => {
    let insertedCategoryId: number | undefined;
    const mockPatternRun = vi.fn();

    mockDb.prepare.mockImplementation((sql: string) => {
      if (sql.includes('category_patterns') && sql.includes('pattern = ?'))
        return { get: vi.fn().mockReturnValue(undefined) };
      if (sql.includes('INTO category_patterns'))
        return {
          run: (...args: any[]) => {
            insertedCategoryId = args[0];
            mockPatternRun(...args);
          },
        };
      if (sql.includes('FROM categories WHERE workspace_id'))
        return { all: vi.fn().mockReturnValue([]) };
      if (sql.includes('INTO categories'))
        return { run: vi.fn().mockReturnValue({ lastInsertRowid: 77 }) };
      return { all: vi.fn().mockReturnValue([]), get: vi.fn(), run: vi.fn() };
    });

    const backup = makeBackup({
      categories: [
        { name: 'New', color: null, icon: null, isDefault: false, patterns: [{ bankId: 'novo_banco', pattern: 'TEST', priority: 0 }] },
      ],
    });

    const stats = importWorkspaceData(1, backup);

    expect(stats.patternsImported).toBe(1);
    expect(insertedCategoryId).toBe(77);
  });

  it('imports patterns for existing categories', () => {
    let insertedCategoryId: number | undefined;
    const mockPatternRun = vi.fn();

    mockDb.prepare.mockImplementation((sql: string) => {
      if (sql.includes('category_patterns') && sql.includes('pattern = ?'))
        return { get: vi.fn().mockReturnValue(undefined) };
      if (sql.includes('INTO category_patterns'))
        return {
          run: (...args: any[]) => {
            insertedCategoryId = args[0];
            mockPatternRun(...args);
          },
        };
      if (sql.includes('FROM categories WHERE workspace_id'))
        return { all: vi.fn().mockReturnValue([{ id: 33, name: 'Existing' }]) };
      return { all: vi.fn().mockReturnValue([]), get: vi.fn(), run: vi.fn() };
    });

    const backup = makeBackup({
      categories: [
        { name: 'Existing', color: null, icon: null, isDefault: false, patterns: [{ bankId: 'novo_banco', pattern: 'PAT', priority: 1 }] },
      ],
    });

    const stats = importWorkspaceData(1, backup);

    expect(stats.patternsImported).toBe(1);
    expect(insertedCategoryId).toBe(33);
  });

  it('skips duplicate patterns', () => {
    mockDb.prepare.mockImplementation(prepareMockRouter({
      existingCategories: [{ id: 5, name: 'Food' }],
      patternDupCheck: { id: 99 },
    }));

    const backup = makeBackup({
      categories: [
        { name: 'Food', color: null, icon: null, isDefault: false, patterns: [{ bankId: 'novo_banco', pattern: 'DUP', priority: 0 }] },
      ],
    });

    const stats = importWorkspaceData(1, backup);

    expect(stats.patternsImported).toBe(0);
    expect(stats.patternsSkipped).toBe(1);
  });

  // --- Ledger import tests ---

  it('imports new ledgers with transactions', () => {
    const txRun = vi.fn();

    mockDb.prepare.mockImplementation((sql: string) => {
      if (sql.includes('FROM categories WHERE workspace_id'))
        return { all: vi.fn().mockReturnValue([{ id: 1, name: 'Food' }]) };
      if (sql.includes('SELECT id FROM ledgers WHERE file_hash'))
        return { get: vi.fn().mockReturnValue(undefined) };
      if (sql.includes('INTO ledgers'))
        return { run: vi.fn().mockReturnValue({ lastInsertRowid: 300 }) };
      if (sql.includes('INTO transactions'))
        return { run: txRun };
      return { all: vi.fn().mockReturnValue([]), get: vi.fn(), run: vi.fn() };
    });

    const backup = makeBackup({
      ledgers: [{
        filename: 'jan.pdf',
        uploadDate: '2024-01-15',
        periodStart: '2024-01-01',
        periodEnd: '2024-01-31',
        bankId: 'novo_banco',
        fileHash: 'hash1',
        transactions: [
          { date: '2024-01-10', description: 'Shop', amount: -50, balance: 1000, categoryName: 'Food', isIncome: false, isManual: false, rawText: null },
          { date: '2024-01-20', description: 'Pay', amount: 2000, balance: 3000, categoryName: null, isIncome: true, isManual: true, rawText: 'RAW' },
        ],
      }],
    });

    const stats = importWorkspaceData(1, backup);

    expect(stats.ledgersImported).toBe(1);
    expect(stats.transactionsImported).toBe(2);
    expect(txRun).toHaveBeenCalledTimes(2);
  });

  it('skips duplicate ledgers by file_hash', () => {
    mockDb.prepare.mockImplementation(prepareMockRouter({
      ledgerDupCheck: { id: 42 },
    }));

    const backup = makeBackup({
      ledgers: [{
        filename: 'dup.pdf',
        uploadDate: '2024-01-01',
        periodStart: null,
        periodEnd: null,
        bankId: 'novo_banco',
        fileHash: 'existing_hash',
        transactions: [
          { date: '2024-01-01', description: 'X', amount: -10, balance: null, categoryName: null, isIncome: false, isManual: false, rawText: null },
        ],
      }],
    });

    const stats = importWorkspaceData(1, backup);

    expect(stats.ledgersSkipped).toBe(1);
    expect(stats.ledgersImported).toBe(0);
    expect(stats.transactionsImported).toBe(0);
  });

  it('imports ledgers without file_hash (no dedup check)', () => {
    mockDb.prepare.mockImplementation(prepareMockRouter({
      ledgerInsert: { lastInsertRowid: 500 },
    }));

    const backup = makeBackup({
      ledgers: [{
        filename: 'no-hash.pdf',
        uploadDate: '2024-02-01',
        periodStart: null,
        periodEnd: null,
        bankId: 'novo_banco',
        fileHash: null,
        transactions: [],
      }],
    });

    const stats = importWorkspaceData(1, backup);

    expect(stats.ledgersImported).toBe(1);
    expect(stats.ledgersSkipped).toBe(0);
  });

  it('maps category names to IDs in transactions', () => {
    const capturedTxArgs: any[][] = [];

    mockDb.prepare.mockImplementation((sql: string) => {
      if (sql.includes('FROM categories WHERE workspace_id'))
        return { all: vi.fn().mockReturnValue([{ id: 7, name: 'Groceries' }]) };
      if (sql.includes('SELECT id FROM ledgers WHERE file_hash'))
        return { get: vi.fn().mockReturnValue(undefined) };
      if (sql.includes('INTO ledgers'))
        return { run: vi.fn().mockReturnValue({ lastInsertRowid: 600 }) };
      if (sql.includes('INTO transactions'))
        return {
          run: (...args: any[]) => { capturedTxArgs.push(args); },
        };
      return { all: vi.fn().mockReturnValue([]), get: vi.fn(), run: vi.fn() };
    });

    const backup = makeBackup({
      ledgers: [{
        filename: 'f.pdf',
        uploadDate: '2024-01-01',
        periodStart: null,
        periodEnd: null,
        bankId: 'novo_banco',
        fileHash: 'h1',
        transactions: [
          { date: '2024-01-01', description: 'G', amount: -20, balance: null, categoryName: 'Groceries', isIncome: false, isManual: false, rawText: null },
        ],
      }],
    });

    importWorkspaceData(1, backup);

    // category_id should be 7 (6th positional arg: ledgerId, date, desc, amount, balance, categoryId, ...)
    expect(capturedTxArgs[0][5]).toBe(7);
  });

  it('handles null categoryName in transactions', () => {
    const capturedTxArgs: any[][] = [];

    mockDb.prepare.mockImplementation((sql: string) => {
      if (sql.includes('FROM categories WHERE workspace_id'))
        return { all: vi.fn().mockReturnValue([]) };
      if (sql.includes('SELECT id FROM ledgers WHERE file_hash'))
        return { get: vi.fn().mockReturnValue(undefined) };
      if (sql.includes('INTO ledgers'))
        return { run: vi.fn().mockReturnValue({ lastInsertRowid: 700 }) };
      if (sql.includes('INTO transactions'))
        return {
          run: (...args: any[]) => { capturedTxArgs.push(args); },
        };
      return { all: vi.fn().mockReturnValue([]), get: vi.fn(), run: vi.fn() };
    });

    const backup = makeBackup({
      ledgers: [{
        filename: 'f.pdf',
        uploadDate: '2024-01-01',
        periodStart: null,
        periodEnd: null,
        bankId: 'novo_banco',
        fileHash: 'h2',
        transactions: [
          { date: '2024-01-01', description: 'X', amount: -5, balance: null, categoryName: null, isIncome: false, isManual: false, rawText: null },
        ],
      }],
    });

    importWorkspaceData(1, backup);

    // category_id should be null
    expect(capturedTxArgs[0][5]).toBeNull();
  });

  // --- Recurring pattern import tests ---

  it('imports recurring patterns', () => {
    mockDb.prepare.mockImplementation(prepareMockRouter({
      recurringDupCheck: undefined,
    }));

    const backup = makeBackup({
      recurringPatterns: [
        { descriptionPattern: 'NETFLIX', frequency: 'monthly', avgAmount: 15.99, occurrenceCount: 6, isActive: true },
      ],
    });

    const stats = importWorkspaceData(1, backup);

    expect(stats.recurringPatternsImported).toBe(1);
    expect(stats.recurringPatternsSkipped).toBe(0);
  });

  it('skips duplicate recurring patterns', () => {
    mockDb.prepare.mockImplementation(prepareMockRouter({
      recurringDupCheck: { id: 10 },
    }));

    const backup = makeBackup({
      recurringPatterns: [
        { descriptionPattern: 'NETFLIX', frequency: 'monthly', avgAmount: 15.99, occurrenceCount: 6, isActive: true },
      ],
    });

    const stats = importWorkspaceData(1, backup);

    expect(stats.recurringPatternsImported).toBe(0);
    expect(stats.recurringPatternsSkipped).toBe(1);
  });

  // --- Aggregate / edge-case tests ---

  it('returns correct ImportStats', () => {
    // Setup: 1 new cat, 1 existing cat, patterns for both (1 dup), 1 new ledger with 2 txs, 1 dup ledger, 1 new recurring, 1 dup recurring
    let categoryInsertCount = 0;

    // Persistent mocks for calls that need mockReturnValueOnce across multiple prepare() calls
    const patternDupGet = vi.fn()
      .mockReturnValueOnce(undefined)      // P1 → new
      .mockReturnValueOnce({ id: 1 })      // P2 → dup
      .mockReturnValueOnce(undefined);     // P3 → new
    const ledgerDupGet = vi.fn()
      .mockReturnValueOnce(undefined)      // first ledger → new
      .mockReturnValueOnce({ id: 42 });    // second ledger → dup
    const recurringDupGet = vi.fn()
      .mockReturnValueOnce(undefined)      // first → new
      .mockReturnValueOnce({ id: 5 });     // second → dup

    mockDb.prepare.mockImplementation((sql: string) => {
      if (sql.includes('category_patterns') && sql.includes('pattern = ?'))
        return { get: patternDupGet };
      if (sql.includes('INTO category_patterns'))
        return { run: vi.fn() };
      if (sql.includes('FROM categories WHERE workspace_id'))
        return { all: vi.fn().mockReturnValue([{ id: 1, name: 'Existing' }]) };
      if (sql.includes('INTO categories')) {
        categoryInsertCount++;
        return { run: vi.fn().mockReturnValue({ lastInsertRowid: 80 + categoryInsertCount }) };
      }
      if (sql.includes('SELECT id FROM ledgers WHERE file_hash'))
        return { get: ledgerDupGet };
      if (sql.includes('INTO ledgers'))
        return { run: vi.fn().mockReturnValue({ lastInsertRowid: 200 }) };
      if (sql.includes('INTO transactions'))
        return { run: vi.fn() };
      if (sql.includes('SELECT id FROM recurring_patterns'))
        return { get: recurringDupGet };
      if (sql.includes('INTO recurring_patterns'))
        return { run: vi.fn() };
      return { all: vi.fn().mockReturnValue([]), get: vi.fn(), run: vi.fn() };
    });

    const backup = makeBackup({
      categories: [
        { name: 'Existing', color: null, icon: null, isDefault: false, patterns: [{ bankId: 'b', pattern: 'P1', priority: 0 }, { bankId: 'b', pattern: 'P2', priority: 0 }] },
        { name: 'NewCat', color: null, icon: null, isDefault: false, patterns: [{ bankId: 'b', pattern: 'P3', priority: 0 }] },
      ],
      ledgers: [
        { filename: 'a.pdf', uploadDate: '2024-01-01', periodStart: null, periodEnd: null, bankId: 'novo_banco', fileHash: 'new_hash', transactions: [
          { date: '2024-01-01', description: 'T1', amount: -10, balance: null, categoryName: null, isIncome: false, isManual: false, rawText: null },
          { date: '2024-01-02', description: 'T2', amount: -20, balance: null, categoryName: null, isIncome: false, isManual: false, rawText: null },
        ] },
        { filename: 'b.pdf', uploadDate: '2024-02-01', periodStart: null, periodEnd: null, bankId: 'novo_banco', fileHash: 'dup_hash', transactions: [
          { date: '2024-02-01', description: 'T3', amount: -30, balance: null, categoryName: null, isIncome: false, isManual: false, rawText: null },
        ] },
      ],
      recurringPatterns: [
        { descriptionPattern: 'NEW_RP', frequency: 'monthly', avgAmount: 10, occurrenceCount: 3, isActive: true },
        { descriptionPattern: 'DUP_RP', frequency: 'weekly', avgAmount: 5, occurrenceCount: 1, isActive: false },
      ],
    });

    const stats = importWorkspaceData(1, backup);

    expect(stats.categoriesImported).toBe(1);
    expect(stats.categoriesSkipped).toBe(1);
    expect(stats.patternsImported).toBe(2);
    expect(stats.patternsSkipped).toBe(1);
    expect(stats.ledgersImported).toBe(1);
    expect(stats.ledgersSkipped).toBe(1);
    expect(stats.transactionsImported).toBe(2);
    expect(stats.recurringPatternsImported).toBe(1);
    expect(stats.recurringPatternsSkipped).toBe(1);
  });

  it('handles empty backup', () => {
    mockDb.prepare.mockImplementation(prepareMockRouter());

    const backup = makeBackup();
    const stats = importWorkspaceData(1, backup);

    expect(stats.categoriesImported).toBe(0);
    expect(stats.categoriesSkipped).toBe(0);
    expect(stats.patternsImported).toBe(0);
    expect(stats.patternsSkipped).toBe(0);
    expect(stats.ledgersImported).toBe(0);
    expect(stats.ledgersSkipped).toBe(0);
    expect(stats.transactionsImported).toBe(0);
    expect(stats.recurringPatternsImported).toBe(0);
    expect(stats.recurringPatternsSkipped).toBe(0);
  });

  it('runs inside a database transaction', () => {
    mockDb.prepare.mockImplementation(prepareMockRouter());

    const backup = makeBackup();
    importWorkspaceData(1, backup);

    expect(mockDb.transaction).toHaveBeenCalledTimes(1);
    expect(mockDb.transaction).toHaveBeenCalledWith(expect.any(Function));
  });
});
