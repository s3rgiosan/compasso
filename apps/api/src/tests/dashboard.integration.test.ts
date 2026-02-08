import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  setupTestApp,
  cleanupTestApp,
  createTestUser,
  createTestLedger,
  createTestTransaction,
  type TestUser,
} from './integration-helpers.js';
import type supertest from 'supertest';

let agent: supertest.Agent;

beforeEach(() => {
  agent = setupTestApp();
});

afterEach(() => {
  cleanupTestApp();
});

describe('Dashboard & Reports Integration', () => {
  let user: TestUser;

  beforeEach(() => {
    user = createTestUser('dashuser', 'password123', 'dash@test.com');
  });

  describe('GET /api/dashboard', () => {
    it('returns summary cards with date filters', async () => {
      const ledgerId = createTestLedger(user.workspaceId);
      createTestTransaction(ledgerId, { date: '2024-06-15', amount: 500, isIncome: true });
      createTestTransaction(ledgerId, { date: '2024-06-20', amount: 100, isIncome: false });
      createTestTransaction(ledgerId, { date: '2024-07-05', amount: 200, isIncome: false });

      const res = await agent
        .get('/api/dashboard')
        .set('Authorization', `Bearer ${user.sessionId}`)
        .query({ workspaceId: user.workspaceId, year: 2024, month: 6 });

      expect(res.status).toBe(200);
      const { summary } = res.body.data;
      expect(summary.totalIncome).toBe(500);
      expect(summary.totalExpenses).toBe(100);
      expect(summary.balance).toBe(400);
      expect(summary.transactionCount).toBe(2);
    });

    it('returns monthly trends', async () => {
      const ledgerId = createTestLedger(user.workspaceId);
      createTestTransaction(ledgerId, { date: '2024-01-15', amount: 1000, isIncome: true });
      createTestTransaction(ledgerId, { date: '2024-01-20', amount: 300, isIncome: false });
      createTestTransaction(ledgerId, { date: '2024-02-15', amount: 800, isIncome: true });
      createTestTransaction(ledgerId, { date: '2024-02-20', amount: 200, isIncome: false });

      const res = await agent
        .get('/api/dashboard')
        .set('Authorization', `Bearer ${user.sessionId}`)
        .query({ workspaceId: user.workspaceId, year: 2024 });

      expect(res.status).toBe(200);
      const { monthlyTrends } = res.body.data;
      expect(monthlyTrends.length).toBe(2);
      expect(monthlyTrends[0].month).toBe('2024-01');
      expect(monthlyTrends[0].income).toBe(1000);
      expect(monthlyTrends[0].expenses).toBe(300);
      expect(monthlyTrends[1].month).toBe('2024-02');
    });

    it('returns category breakdown for expenses', async () => {
      const ledgerId = createTestLedger(user.workspaceId);

      // Create a category
      const catRes = await agent
        .post('/api/categories')
        .set('Authorization', `Bearer ${user.sessionId}`)
        .send({ name: 'Food', workspaceId: user.workspaceId });
      const foodCatId = catRes.body.data.id;

      createTestTransaction(ledgerId, { date: '2024-06-15', amount: 100, isIncome: false, categoryId: foodCatId });
      createTestTransaction(ledgerId, { date: '2024-06-16', amount: 50, isIncome: false, categoryId: null });

      const res = await agent
        .get('/api/dashboard')
        .set('Authorization', `Bearer ${user.sessionId}`)
        .query({ workspaceId: user.workspaceId, year: 2024 });

      expect(res.status).toBe(200);
      const { categoryBreakdown } = res.body.data;
      expect(categoryBreakdown.length).toBeGreaterThan(0);

      const foodBreakdown = categoryBreakdown.find((c: any) => c.categoryName === 'Food');
      expect(foodBreakdown).toBeDefined();
      expect(foodBreakdown.total).toBe(100);
    });

    it('empty workspace returns zeroes, not errors', async () => {
      const res = await agent
        .get('/api/dashboard')
        .set('Authorization', `Bearer ${user.sessionId}`)
        .query({ workspaceId: user.workspaceId });

      expect(res.status).toBe(200);
      const { summary } = res.body.data;
      expect(summary.totalIncome).toBe(0);
      expect(summary.totalExpenses).toBe(0);
      expect(summary.balance).toBe(0);
      expect(summary.transactionCount).toBe(0);
    });
  });

  describe('GET /api/dashboard/years', () => {
    it('returns available years', async () => {
      const ledgerId = createTestLedger(user.workspaceId);
      createTestTransaction(ledgerId, { date: '2024-01-15', amount: 100 });
      createTestTransaction(ledgerId, { date: '2023-06-15', amount: 200 });

      const res = await agent
        .get('/api/dashboard/years')
        .set('Authorization', `Bearer ${user.sessionId}`)
        .query({ workspaceId: user.workspaceId });

      expect(res.status).toBe(200);
      expect(res.body.data).toContain(2024);
      expect(res.body.data).toContain(2023);
    });
  });

  describe('GET /api/reports/yearly', () => {
    it('returns yearly summary', async () => {
      const ledgerId = createTestLedger(user.workspaceId);
      createTestTransaction(ledgerId, { date: '2024-03-15', amount: 2000, isIncome: true });
      createTestTransaction(ledgerId, { date: '2024-03-20', amount: 500, isIncome: false });
      createTestTransaction(ledgerId, { date: '2024-06-10', amount: 300, isIncome: false });

      const res = await agent
        .get('/api/reports/yearly')
        .set('Authorization', `Bearer ${user.sessionId}`)
        .query({ workspaceId: user.workspaceId, year: 2024 });

      expect(res.status).toBe(200);
      const data = res.body.data;
      expect(data.year).toBe(2024);
      expect(data.totalIncome).toBe(2000);
      expect(data.totalExpenses).toBe(800);
      expect(data.netSavings).toBe(1200);
      expect(data.transactionCount).toBe(3);
      expect(data.monthlyBreakdown.length).toBeGreaterThan(0);
    });
  });

  describe('GET /api/reports/years', () => {
    it('returns available years for reports', async () => {
      const ledgerId = createTestLedger(user.workspaceId);
      createTestTransaction(ledgerId, { date: '2024-01-01', amount: 100 });

      const res = await agent
        .get('/api/reports/years')
        .set('Authorization', `Bearer ${user.sessionId}`)
        .query({ workspaceId: user.workspaceId });

      expect(res.status).toBe(200);
      expect(res.body.data).toContain(2024);
    });
  });

  describe('GET /api/reports/category-trends', () => {
    it('returns category spending trends', async () => {
      const ledgerId = createTestLedger(user.workspaceId);

      const catRes = await agent
        .post('/api/categories')
        .set('Authorization', `Bearer ${user.sessionId}`)
        .send({ name: 'Trending Cat', workspaceId: user.workspaceId });
      const catId = catRes.body.data.id;

      createTestTransaction(ledgerId, { date: '2024-01-15', amount: 100, isIncome: false, categoryId: catId });
      createTestTransaction(ledgerId, { date: '2024-02-15', amount: 150, isIncome: false, categoryId: catId });

      const res = await agent
        .get('/api/reports/category-trends')
        .set('Authorization', `Bearer ${user.sessionId}`)
        .query({ workspaceId: user.workspaceId });

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });
});
