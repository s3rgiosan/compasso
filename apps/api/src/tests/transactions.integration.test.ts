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

describe('Transactions Integration', () => {
  let user: TestUser;
  let ledgerId: number;

  beforeEach(() => {
    user = createTestUser('txuser', 'password123', 'txuser@test.com');
    ledgerId = createTestLedger(user.workspaceId);
  });

  describe('GET /api/transactions', () => {
    it('lists transactions with year filter', async () => {
      createTestTransaction(ledgerId, { date: '2024-06-15', description: 'June tx', amount: 100 });
      createTestTransaction(ledgerId, { date: '2023-06-15', description: 'Old tx', amount: 200 });

      const res = await agent
        .get('/api/transactions')
        .set('Authorization', `Bearer ${user.sessionId}`)
        .query({ workspaceId: user.workspaceId, year: 2024 });

      expect(res.status).toBe(200);
      expect(res.body.data.items.length).toBe(1);
      expect(res.body.data.items[0].description).toBe('June tx');
    });

    it('lists transactions with month filter', async () => {
      createTestTransaction(ledgerId, { date: '2024-06-15', description: 'June tx', amount: 100 });
      createTestTransaction(ledgerId, { date: '2024-07-15', description: 'July tx', amount: 200 });

      const res = await agent
        .get('/api/transactions')
        .set('Authorization', `Bearer ${user.sessionId}`)
        .query({ workspaceId: user.workspaceId, year: 2024, month: 6 });

      expect(res.status).toBe(200);
      expect(res.body.data.items.length).toBe(1);
      expect(res.body.data.items[0].description).toBe('June tx');
    });

    it('lists transactions with search filter', async () => {
      createTestTransaction(ledgerId, { description: 'GROCERY STORE', amount: 50 });
      createTestTransaction(ledgerId, { description: 'GAS STATION', amount: 30 });

      const res = await agent
        .get('/api/transactions')
        .set('Authorization', `Bearer ${user.sessionId}`)
        .query({ workspaceId: user.workspaceId, search: 'GROCERY' });

      expect(res.status).toBe(200);
      expect(res.body.data.items.length).toBe(1);
      expect(res.body.data.items[0].description).toBe('GROCERY STORE');
    });

    it('lists transactions with type filter', async () => {
      createTestTransaction(ledgerId, { description: 'Income', amount: 1000, isIncome: true });
      createTestTransaction(ledgerId, { description: 'Expense', amount: 50, isIncome: false });

      const res = await agent
        .get('/api/transactions')
        .set('Authorization', `Bearer ${user.sessionId}`)
        .query({ workspaceId: user.workspaceId, isIncome: 'true' });

      expect(res.status).toBe(200);
      expect(res.body.data.items.length).toBe(1);
      expect(res.body.data.items[0].description).toBe('Income');
    });

    it('paginates results', async () => {
      for (let i = 0; i < 5; i++) {
        createTestTransaction(ledgerId, { description: `TX ${i}`, amount: 10 * i, date: `2024-01-${String(i + 1).padStart(2, '0')}` });
      }

      const res = await agent
        .get('/api/transactions')
        .set('Authorization', `Bearer ${user.sessionId}`)
        .query({ workspaceId: user.workspaceId, limit: 2, offset: 0 });

      expect(res.status).toBe(200);
      expect(res.body.data.items.length).toBe(2);
      expect(res.body.data.total).toBe(5);
      expect(res.body.data.limit).toBe(2);
      expect(res.body.data.offset).toBe(0);

      const res2 = await agent
        .get('/api/transactions')
        .set('Authorization', `Bearer ${user.sessionId}`)
        .query({ workspaceId: user.workspaceId, limit: 2, offset: 2 });

      expect(res2.body.data.items.length).toBe(2);
      expect(res2.body.data.offset).toBe(2);
    });
  });

  describe('PUT /api/transactions/:id', () => {
    it('updates transaction category and sets is_manual', async () => {
      const txId = createTestTransaction(ledgerId, { description: 'Test', amount: 100 });

      // Create a category to assign
      const catRes = await agent
        .post('/api/categories')
        .set('Authorization', `Bearer ${user.sessionId}`)
        .send({ name: 'Assigned Cat', workspaceId: user.workspaceId });

      const categoryId = catRes.body.data.id;

      const res = await agent
        .put(`/api/transactions/${txId}`)
        .set('Authorization', `Bearer ${user.sessionId}`)
        .send({ categoryId, workspaceId: user.workspaceId });

      expect(res.status).toBe(200);

      // Verify in DB
      const db = getDatabase();
      const tx = db.prepare('SELECT category_id, is_manual FROM transactions WHERE id = ?').get(txId) as any;
      expect(tx.category_id).toBe(categoryId);
      expect(tx.is_manual).toBe(1);
    });
  });

  describe('DELETE /api/transactions/:id', () => {
    it('removes transaction from DB', async () => {
      const txId = createTestTransaction(ledgerId, { description: 'To delete', amount: 50 });

      const res = await agent
        .delete(`/api/transactions/${txId}`)
        .set('Authorization', `Bearer ${user.sessionId}`)
        .query({ workspaceId: user.workspaceId });

      expect(res.status).toBe(200);

      // Verify deleted
      const db = getDatabase();
      const tx = db.prepare('SELECT id FROM transactions WHERE id = ?').get(txId);
      expect(tx).toBeUndefined();
    });
  });

  describe('GET /api/transactions/export', () => {
    it('exports CSV with current filters', async () => {
      createTestTransaction(ledgerId, { date: '2024-06-15', description: 'Export tx', amount: 100, isIncome: false });
      createTestTransaction(ledgerId, { date: '2024-07-15', description: 'Other tx', amount: 200, isIncome: true });

      const res = await agent
        .get('/api/transactions/export')
        .set('Authorization', `Bearer ${user.sessionId}`)
        .query({ workspaceId: user.workspaceId, year: 2024, month: 6 });

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/text\/csv/);
      expect(res.text).toContain('Export tx');
      expect(res.text).not.toContain('Other tx');
    });
  });

  describe('Cross-workspace isolation', () => {
    it('cannot access another workspace transactions', async () => {
      const userB = createTestUser('txuserb', 'password123', 'txuserb@test.com');
      const ledgerB = createTestLedger(userB.workspaceId);
      createTestTransaction(ledgerB, { description: 'B private tx', amount: 999 });

      // User A tries to list user B's workspace transactions
      const res = await agent
        .get('/api/transactions')
        .set('Authorization', `Bearer ${user.sessionId}`)
        .query({ workspaceId: userB.workspaceId });

      expect(res.status).toBe(403);
    });
  });
});
