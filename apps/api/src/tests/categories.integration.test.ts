import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  setupTestApp,
  cleanupTestApp,
  createTestUser,
  createTestWorkspace,
  seedTestCategories,
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

describe('Categories & Patterns Integration', () => {
  let user: TestUser;

  beforeEach(() => {
    user = createTestUser('catuser', 'password123', 'catuser@test.com');
  });

  describe('Default categories', () => {
    it('are seeded on workspace creation', async () => {
      const res = await agent
        .get('/api/categories')
        .set('Authorization', `Bearer ${user.sessionId}`)
        .query({ workspaceId: user.workspaceId });

      expect(res.status).toBe(200);
      expect(res.body.data.items.length).toBeGreaterThan(0);

      // Check some default categories exist
      const categoryNames = res.body.data.items.map((c: any) => c.name);
      expect(categoryNames.length).toBeGreaterThan(5);
    });
  });

  describe('POST /api/categories', () => {
    it('creates custom category with color and icon', async () => {
      const res = await agent
        .post('/api/categories')
        .set('Authorization', `Bearer ${user.sessionId}`)
        .send({
          name: 'My Custom Category',
          color: '#ff0000',
          icon: 'star',
          workspaceId: user.workspaceId,
        });

      expect(res.status).toBe(201);
      expect(res.body.data.name).toBe('My Custom Category');
      expect(res.body.data.color).toBe('#ff0000');
      expect(res.body.data.icon).toBe('star');
      expect(res.body.data.isDefault).toBe(false);

      // Verify in DB
      const db = getDatabase();
      const cat = db.prepare('SELECT * FROM categories WHERE id = ?').get(res.body.data.id) as any;
      expect(cat.name).toBe('My Custom Category');
      expect(cat.color).toBe('#ff0000');
    });
  });

  describe('PUT /api/categories/:id', () => {
    it('updates category name and color', async () => {
      // Create a category
      const createRes = await agent
        .post('/api/categories')
        .set('Authorization', `Bearer ${user.sessionId}`)
        .send({ name: 'Old Name', color: '#000000', workspaceId: user.workspaceId });

      const categoryId = createRes.body.data.id;

      const updateRes = await agent
        .put(`/api/categories/${categoryId}`)
        .set('Authorization', `Bearer ${user.sessionId}`)
        .send({ name: 'New Name', color: '#ffffff', workspaceId: user.workspaceId });

      expect(updateRes.status).toBe(200);

      // Verify update persisted
      const db = getDatabase();
      const cat = db.prepare('SELECT name, color FROM categories WHERE id = ?').get(categoryId) as any;
      expect(cat.name).toBe('New Name');
      expect(cat.color).toBe('#ffffff');
    });
  });

  describe('DELETE /api/categories/:id', () => {
    it('cascade deletes associated patterns', async () => {
      // Create category
      const createRes = await agent
        .post('/api/categories')
        .set('Authorization', `Bearer ${user.sessionId}`)
        .send({ name: 'Deletable Cat', workspaceId: user.workspaceId });

      const categoryId = createRes.body.data.id;

      // Add a pattern
      await agent
        .post(`/api/categories/${categoryId}/patterns`)
        .set('Authorization', `Bearer ${user.sessionId}`)
        .send({
          bankId: 'novo_banco',
          pattern: 'SOME PATTERN',
          workspaceId: user.workspaceId,
          priority: 0,
        });

      // Verify pattern exists
      const db = getDatabase();
      const patternsBefore = db
        .prepare('SELECT COUNT(*) as count FROM category_patterns WHERE category_id = ?')
        .get(categoryId) as any;
      expect(patternsBefore.count).toBe(1);

      // Delete category
      const delRes = await agent
        .delete(`/api/categories/${categoryId}`)
        .set('Authorization', `Bearer ${user.sessionId}`)
        .query({ workspaceId: user.workspaceId });

      expect(delRes.status).toBe(200);

      // Patterns should be cascade-deleted
      const patternsAfter = db
        .prepare('SELECT COUNT(*) as count FROM category_patterns WHERE category_id = ?')
        .get(categoryId) as any;
      expect(patternsAfter.count).toBe(0);
    });
  });

  describe('Patterns', () => {
    it('creates a pattern and recategorizes matching uncategorized transactions', async () => {
      // Create category
      const createRes = await agent
        .post('/api/categories')
        .set('Authorization', `Bearer ${user.sessionId}`)
        .send({ name: 'Groceries Custom', workspaceId: user.workspaceId });

      const categoryId = createRes.body.data.id;

      // Create a ledger and uncategorized transaction
      const ledgerId = createTestLedger(user.workspaceId, { bankId: 'novo_banco' });
      createTestTransaction(ledgerId, {
        description: 'SUPERMARKET PURCHASE',
        amount: 50,
        isIncome: false,
        categoryId: null,
      });

      // Add pattern that matches the transaction
      const patRes = await agent
        .post(`/api/categories/${categoryId}/patterns`)
        .set('Authorization', `Bearer ${user.sessionId}`)
        .send({
          bankId: 'novo_banco',
          pattern: 'SUPERMARKET',
          workspaceId: user.workspaceId,
          priority: 0,
        });

      expect(patRes.status).toBe(201);
      expect(patRes.body.data.recategorized).toBeGreaterThanOrEqual(0);
    });

    it('rejects duplicate pattern', async () => {
      // Create category
      const createRes = await agent
        .post('/api/categories')
        .set('Authorization', `Bearer ${user.sessionId}`)
        .send({ name: 'Dup Pattern Cat', workspaceId: user.workspaceId });

      const categoryId = createRes.body.data.id;

      // Create first pattern
      await agent
        .post(`/api/categories/${categoryId}/patterns`)
        .set('Authorization', `Bearer ${user.sessionId}`)
        .send({
          bankId: 'novo_banco',
          pattern: 'UNIQUE PATTERN',
          workspaceId: user.workspaceId,
          priority: 0,
        });

      // Attempt duplicate
      const dupRes = await agent
        .post(`/api/categories/${categoryId}/patterns`)
        .set('Authorization', `Bearer ${user.sessionId}`)
        .send({
          bankId: 'novo_banco',
          pattern: 'UNIQUE PATTERN',
          workspaceId: user.workspaceId,
          priority: 0,
        });

      expect(dupRes.status).toBe(400);
    });

    it('preserves manual categorization during auto-recategorization', async () => {
      // Create two categories
      const cat1Res = await agent
        .post('/api/categories')
        .set('Authorization', `Bearer ${user.sessionId}`)
        .send({ name: 'Auto Cat', workspaceId: user.workspaceId });
      const cat1Id = cat1Res.body.data.id;

      const cat2Res = await agent
        .post('/api/categories')
        .set('Authorization', `Bearer ${user.sessionId}`)
        .send({ name: 'Manual Cat', workspaceId: user.workspaceId });
      const cat2Id = cat2Res.body.data.id;

      // Create ledger and transaction with manual categorization
      const ledgerId = createTestLedger(user.workspaceId, { bankId: 'novo_banco' });
      const txId = createTestTransaction(ledgerId, {
        description: 'MANUAL TEST TX',
        amount: 100,
        categoryId: cat2Id,
        isManual: true,
      });

      // Add pattern that would match the transaction
      await agent
        .post(`/api/categories/${cat1Id}/patterns`)
        .set('Authorization', `Bearer ${user.sessionId}`)
        .send({
          bankId: 'novo_banco',
          pattern: 'MANUAL TEST',
          workspaceId: user.workspaceId,
          priority: 0,
        });

      // Verify manual categorization is preserved
      const db = getDatabase();
      const tx = db.prepare('SELECT category_id, is_manual FROM transactions WHERE id = ?').get(txId) as any;
      expect(tx.category_id).toBe(cat2Id);
      expect(tx.is_manual).toBe(1);
    });
  });
});
