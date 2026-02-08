import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  setupTestApp,
  cleanupTestApp,
  createTestUser,
  createTestLedger,
  createTestTransaction,
  type TestUser,
} from './integration-helpers.js';
import { getDatabase } from '../db/database.js';
import type supertest from 'supertest';

let agent: supertest.Agent;

beforeEach(() => {
  agent = setupTestApp();
});

afterEach(() => {
  cleanupTestApp();
});

describe('Upload Flow Integration', () => {
  let user: TestUser;

  beforeEach(() => {
    user = createTestUser('uploaduser', 'password123', 'upload@test.com');
  });

  describe('POST /api/transactions/confirm', () => {
    it('confirms upload and creates transactions with categories', async () => {
      const ledgerId = createTestLedger(user.workspaceId, { bankId: 'novo_banco' });

      // Get a category to assign
      const catRes = await agent
        .get('/api/categories')
        .set('Authorization', `Bearer ${user.sessionId}`)
        .query({ workspaceId: user.workspaceId });

      const categoryId = catRes.body.data.items[0]?.id || null;

      const transactions = [
        {
          date: '2024-01-15',
          description: 'Test transaction 1',
          amount: 100,
          balance: 500,
          categoryId,
          isIncome: false,
          rawText: 'raw text 1',
        },
        {
          date: '2024-01-16',
          description: 'Test transaction 2',
          amount: 200,
          balance: 300,
          categoryId: null,
          isIncome: true,
          rawText: 'raw text 2',
        },
      ];

      const res = await agent
        .post('/api/transactions/confirm')
        .set('Authorization', `Bearer ${user.sessionId}`)
        .send({ ledgerId, transactions });

      expect(res.status).toBe(200);
      expect(res.body.data.count).toBe(2);

      // Verify transactions exist in DB
      const db = getDatabase();
      const txs = db
        .prepare('SELECT * FROM transactions WHERE ledger_id = ? ORDER BY date')
        .all(ledgerId) as any[];
      expect(txs.length).toBe(2);
      expect(txs[0].description).toBe('Test transaction 1');
      expect(txs[1].description).toBe('Test transaction 2');
    });
  });

  describe('Duplicate file hash', () => {
    it('rejects ledger with duplicate file_hash via DB constraint', async () => {
      const db = getDatabase();

      // Create ledger with hash
      createTestLedger(user.workspaceId, { fileHash: 'abc123', bankId: 'novo_banco' });

      // Attempt duplicate hash in same workspace - should fail
      expect(() => {
        db.prepare(
          'INSERT INTO ledgers (filename, bank_id, file_hash, workspace_id) VALUES (?, ?, ?, ?)'
        ).run('dup.pdf', 'novo_banco', 'abc123', user.workspaceId);
      }).toThrow();
    });
  });

  describe('DELETE /api/upload/ledgers/:id', () => {
    it('cascade deletes all transactions', async () => {
      const ledgerId = createTestLedger(user.workspaceId);
      createTestTransaction(ledgerId, { description: 'TX1', amount: 100 });
      createTestTransaction(ledgerId, { description: 'TX2', amount: 200 });

      const db = getDatabase();
      const txsBefore = db
        .prepare('SELECT COUNT(*) as count FROM transactions WHERE ledger_id = ?')
        .get(ledgerId) as any;
      expect(txsBefore.count).toBe(2);

      const res = await agent
        .delete(`/api/upload/ledgers/${ledgerId}`)
        .set('Authorization', `Bearer ${user.sessionId}`);

      expect(res.status).toBe(200);

      // Ledger deleted
      const ledger = db.prepare('SELECT id FROM ledgers WHERE id = ?').get(ledgerId);
      expect(ledger).toBeUndefined();

      // Transactions cascade deleted
      const txsAfter = db
        .prepare('SELECT COUNT(*) as count FROM transactions WHERE ledger_id = ?')
        .get(ledgerId) as any;
      expect(txsAfter.count).toBe(0);
    });
  });

  describe('GET /api/upload/ledgers', () => {
    it('lists ledgers with filters', async () => {
      createTestLedger(user.workspaceId, { filename: 'jan.pdf', bankId: 'novo_banco' });
      createTestLedger(user.workspaceId, { filename: 'feb.pdf', bankId: 'novo_banco', fileHash: 'unique1' });

      const res = await agent
        .get('/api/upload/ledgers')
        .set('Authorization', `Bearer ${user.sessionId}`)
        .query({ workspaceId: user.workspaceId });

      expect(res.status).toBe(200);
      expect(res.body.data.items.length).toBe(2);
      expect(res.body.data.total).toBe(2);
    });
  });
});
