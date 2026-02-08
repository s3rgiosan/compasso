import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  setupTestApp,
  cleanupTestApp,
  createTestUser,
  createTestWorkspace,
  createTestLedger,
  createTestTransaction,
  addWorkspaceMember,
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

describe('Backup Integration', () => {
  let user: TestUser;

  beforeEach(() => {
    user = createTestUser('backupuser', 'password123', 'backup@test.com');
  });

  describe('Export and import roundtrip', () => {
    it('exports then imports into fresh workspace with matching data', async () => {
      // Create test data in source workspace
      const catRes = await agent
        .post('/api/categories')
        .set('Authorization', `Bearer ${user.sessionId}`)
        .send({ name: 'Custom Export Cat', color: '#ff0000', workspaceId: user.workspaceId });
      const catId = catRes.body.data.id;

      const ledgerId = createTestLedger(user.workspaceId, {
        filename: 'export-test.pdf',
        bankId: 'novo_banco',
      });
      createTestTransaction(ledgerId, {
        date: '2024-01-15',
        description: 'Export TX 1',
        amount: 100,
        categoryId: catId,
        isIncome: false,
      });
      createTestTransaction(ledgerId, {
        date: '2024-01-20',
        description: 'Export TX 2',
        amount: 200,
        isIncome: true,
      });

      // Export
      const exportRes = await agent
        .get('/api/backup/export')
        .set('Authorization', `Bearer ${user.sessionId}`)
        .query({ workspaceId: user.workspaceId });

      expect(exportRes.status).toBe(200);
      const backup = JSON.parse(exportRes.text);
      expect(backup.version).toBe(1);
      expect(backup.categories.length).toBeGreaterThan(0);
      expect(backup.ledgers.length).toBe(1);
      expect(backup.ledgers[0].transactions.length).toBe(2);

      // Create fresh workspace
      const newWsRes = await agent
        .post('/api/workspaces')
        .set('Authorization', `Bearer ${user.sessionId}`)
        .send({ name: 'Import Target' });
      const newWorkspaceId = newWsRes.body.data.id;

      // Import
      const importRes = await agent
        .post('/api/backup/import')
        .set('Authorization', `Bearer ${user.sessionId}`)
        .query({ workspaceId: newWorkspaceId })
        .attach('file', Buffer.from(JSON.stringify(backup)), {
          filename: 'backup.json',
          contentType: 'application/json',
        });

      expect(importRes.status).toBe(200);
      const stats = importRes.body.data;
      expect(stats.ledgersImported).toBe(1);
      expect(stats.transactionsImported).toBe(2);

      // Verify data in new workspace
      const db = getDatabase();
      const txs = db
        .prepare(
          `SELECT t.description FROM transactions t
           JOIN ledgers l ON t.ledger_id = l.id
           WHERE l.workspace_id = ?
           ORDER BY t.date`
        )
        .all(newWorkspaceId) as any[];
      expect(txs.length).toBe(2);
      expect(txs[0].description).toBe('Export TX 1');
      expect(txs[1].description).toBe('Export TX 2');
    });
  });

  describe('Import merge behavior', () => {
    it('skips duplicate categories and ledgers by name/hash', async () => {
      // Create ledger with known hash
      const ledgerId = createTestLedger(user.workspaceId, {
        filename: 'merge-test.pdf',
        bankId: 'novo_banco',
        fileHash: 'mergehash123',
      });
      createTestTransaction(ledgerId, {
        description: 'Merge TX',
        amount: 50,
      });

      // Export
      const exportRes = await agent
        .get('/api/backup/export')
        .set('Authorization', `Bearer ${user.sessionId}`)
        .query({ workspaceId: user.workspaceId });
      const backup = JSON.parse(exportRes.text);

      // Import into same workspace (should skip duplicates)
      const importRes = await agent
        .post('/api/backup/import')
        .set('Authorization', `Bearer ${user.sessionId}`)
        .query({ workspaceId: user.workspaceId })
        .attach('file', Buffer.from(JSON.stringify(backup)), {
          filename: 'backup.json',
          contentType: 'application/json',
        });

      expect(importRes.status).toBe(200);
      const stats = importRes.body.data;
      // All default categories should be skipped (already exist)
      expect(stats.categoriesSkipped).toBeGreaterThan(0);
      // Ledger with same hash should be skipped
      expect(stats.ledgersSkipped).toBe(1);
      expect(stats.ledgersImported).toBe(0);
    });
  });

  describe('Import stats', () => {
    it('returns correct imported/skipped counts', async () => {
      // Export from workspace (which has default categories)
      const exportRes = await agent
        .get('/api/backup/export')
        .set('Authorization', `Bearer ${user.sessionId}`)
        .query({ workspaceId: user.workspaceId });
      const backup = JSON.parse(exportRes.text);

      // Add a new category to the backup that doesn't exist in workspace
      backup.categories.push({
        name: 'Brand New Category',
        color: '#abcdef',
        icon: 'new',
        isDefault: false,
        patterns: [],
      });

      // Create fresh workspace
      const newWsRes = await agent
        .post('/api/workspaces')
        .set('Authorization', `Bearer ${user.sessionId}`)
        .send({ name: 'Stats Target' });
      const newWorkspaceId = newWsRes.body.data.id;

      const importRes = await agent
        .post('/api/backup/import')
        .set('Authorization', `Bearer ${user.sessionId}`)
        .query({ workspaceId: newWorkspaceId })
        .attach('file', Buffer.from(JSON.stringify(backup)), {
          filename: 'backup.json',
          contentType: 'application/json',
        });

      expect(importRes.status).toBe(200);
      const stats = importRes.body.data;
      // The new workspace already has default categories seeded, so most will be skipped
      expect(stats.categoriesSkipped).toBeGreaterThan(0);
      // "Brand New Category" should be imported
      expect(stats.categoriesImported).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Viewer cannot import', () => {
    it('returns 403 for viewer trying to import', async () => {
      const viewer = createTestUser('viewer', 'password123', 'viewer@test.com');

      // Add viewer to user's workspace
      addWorkspaceMember(user.workspaceId, viewer.id, 'viewer');

      const backup = {
        version: 1,
        exportedAt: new Date().toISOString(),
        workspace: { name: 'Test', description: null, color: '#000', icon: 'test' },
        categories: [],
        ledgers: [],
        recurringPatterns: [],
      };

      const res = await agent
        .post('/api/backup/import')
        .set('Authorization', `Bearer ${viewer.sessionId}`)
        .query({ workspaceId: user.workspaceId })
        .attach('file', Buffer.from(JSON.stringify(backup)), {
          filename: 'backup.json',
          contentType: 'application/json',
        });

      expect(res.status).toBe(403);
    });
  });

  describe('Category references by name', () => {
    it('survive cross-workspace import', async () => {
      // Create category and assign transaction to it
      const catRes = await agent
        .post('/api/categories')
        .set('Authorization', `Bearer ${user.sessionId}`)
        .send({ name: 'NameRef Cat', workspaceId: user.workspaceId });
      const catId = catRes.body.data.id;

      const ledgerId = createTestLedger(user.workspaceId, {
        filename: 'nameref.pdf',
        bankId: 'novo_banco',
      });
      createTestTransaction(ledgerId, {
        description: 'Named Cat TX',
        amount: 75,
        categoryId: catId,
        isIncome: false,
      });

      // Export
      const exportRes = await agent
        .get('/api/backup/export')
        .set('Authorization', `Bearer ${user.sessionId}`)
        .query({ workspaceId: user.workspaceId });
      const backup = JSON.parse(exportRes.text);

      // Verify the backup references category by name
      const tx = backup.ledgers[0].transactions.find(
        (t: any) => t.description === 'Named Cat TX'
      );
      expect(tx.categoryName).toBe('NameRef Cat');

      // Import into new workspace
      const newWsRes = await agent
        .post('/api/workspaces')
        .set('Authorization', `Bearer ${user.sessionId}`)
        .send({ name: 'Cross Workspace' });
      const newWorkspaceId = newWsRes.body.data.id;

      await agent
        .post('/api/backup/import')
        .set('Authorization', `Bearer ${user.sessionId}`)
        .query({ workspaceId: newWorkspaceId })
        .attach('file', Buffer.from(JSON.stringify(backup)), {
          filename: 'backup.json',
          contentType: 'application/json',
        });

      // Verify the transaction is linked to a category with the same name in the new workspace
      const db = getDatabase();
      const importedTx = db
        .prepare(
          `SELECT t.category_id, c.name as category_name
           FROM transactions t
           JOIN ledgers l ON t.ledger_id = l.id
           LEFT JOIN categories c ON t.category_id = c.id
           WHERE l.workspace_id = ? AND t.description = 'Named Cat TX'`
        )
        .get(newWorkspaceId) as any;

      expect(importedTx).toBeDefined();
      expect(importedTx.category_name).toBe('NameRef Cat');
    });
  });
});
