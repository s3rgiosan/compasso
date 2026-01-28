import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { createTestApp, TEST_USER } from './test-helpers.js';

vi.mock('../middleware/auth.js', () => ({
  authMiddleware: vi.fn((_req: any, _res: any, next: any) => {
    _req.user = TEST_USER;
    _req.sessionId = 'test-session-id';
    next();
  }),
}));

vi.mock('../services/workspaceService.js', () => ({
  requireWorkspaceMembership: vi.fn(),
}));

vi.mock('../services/recurringDetector.js', () => ({
  detectRecurringPatterns: vi.fn(),
  getRecurringPatterns: vi.fn(),
  deletePattern: vi.fn(),
  getPatternTransactions: vi.fn(),
  updatePattern: vi.fn(),
}));

import router from './recurring.js';
import {
  detectRecurringPatterns,
  getRecurringPatterns,
  deletePattern,
  getPatternTransactions,
  updatePattern,
} from '../services/recurringDetector.js';
import { requireWorkspaceMembership } from '../services/workspaceService.js';

const app = createTestApp(router, '/api/recurring');

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/recurring', () => {
  it('returns 200 with recurring patterns', async () => {
    const patterns = [{ id: 1, description: 'Netflix' }];
    vi.mocked(getRecurringPatterns).mockReturnValue(patterns as any);

    const res = await request(app).get('/api/recurring?workspaceId=1');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, data: patterns });
  });

  it('returns 400 when workspaceId is missing', async () => {
    const res = await request(app).get('/api/recurring');

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('passes workspaceId to service', async () => {
    vi.mocked(getRecurringPatterns).mockReturnValue([]);

    await request(app).get('/api/recurring?workspaceId=5');

    expect(getRecurringPatterns).toHaveBeenCalledWith(5);
  });

  it('checks workspace membership', async () => {
    vi.mocked(getRecurringPatterns).mockReturnValue([]);

    await request(app).get('/api/recurring?workspaceId=3');

    expect(requireWorkspaceMembership).toHaveBeenCalledWith(3, TEST_USER.id);
  });
});

describe('POST /api/recurring/detect', () => {
  it('returns 200 with detection result', async () => {
    vi.mocked(detectRecurringPatterns).mockReturnValue({
      detected: 3,
      patterns: [{ id: 1 }, { id: 2 }, { id: 3 }],
    } as any);

    const res = await request(app)
      .post('/api/recurring/detect')
      .send({ workspaceId: 1 });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      success: true,
      data: { detected: 3, totalPatterns: 3 },
    });
  });

  it('returns 400 when workspaceId is missing from body', async () => {
    const res = await request(app)
      .post('/api/recurring/detect')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('passes workspaceId to service', async () => {
    vi.mocked(detectRecurringPatterns).mockReturnValue({
      detected: 0,
      patterns: [],
    } as any);

    await request(app)
      .post('/api/recurring/detect')
      .send({ workspaceId: 7 });

    expect(detectRecurringPatterns).toHaveBeenCalledWith(7);
  });

  it('checks workspace membership', async () => {
    vi.mocked(detectRecurringPatterns).mockReturnValue({
      detected: 0,
      patterns: [],
    } as any);

    await request(app)
      .post('/api/recurring/detect')
      .send({ workspaceId: 4 });

    expect(requireWorkspaceMembership).toHaveBeenCalledWith(4, TEST_USER.id);
  });
});

describe('PUT /api/recurring/:id', () => {
  it('returns 200 on success with isActive only', async () => {
    vi.mocked(updatePattern).mockReturnValue(true);

    const res = await request(app)
      .put('/api/recurring/1?workspaceId=1')
      .send({ isActive: false });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true });
  });

  it('returns 200 on success with multiple fields', async () => {
    vi.mocked(updatePattern).mockReturnValue(true);

    const res = await request(app)
      .put('/api/recurring/1?workspaceId=1')
      .send({ descriptionPattern: 'UPDATED', frequency: 'weekly', avgAmount: 25.0 });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true });
  });

  it('returns 400 when id is NaN', async () => {
    const res = await request(app)
      .put('/api/recurring/abc?workspaceId=1')
      .send({ isActive: true });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 when no fields provided', async () => {
    const res = await request(app)
      .put('/api/recurring/1?workspaceId=1')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 when workspaceId is missing', async () => {
    const res = await request(app)
      .put('/api/recurring/1')
      .send({ isActive: true });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 404 when pattern not found', async () => {
    vi.mocked(updatePattern).mockReturnValue(false);

    const res = await request(app)
      .put('/api/recurring/999?workspaceId=1')
      .send({ isActive: true });

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('passes all fields to updatePattern', async () => {
    vi.mocked(updatePattern).mockReturnValue(true);

    await request(app)
      .put('/api/recurring/5?workspaceId=1')
      .send({ descriptionPattern: 'TEST', frequency: 'monthly', avgAmount: 10, isActive: true });

    expect(updatePattern).toHaveBeenCalledWith(5, TEST_USER.id, {
      descriptionPattern: 'TEST',
      frequency: 'monthly',
      avgAmount: 10,
      isActive: true,
    });
  });

  it('checks workspace membership', async () => {
    vi.mocked(updatePattern).mockReturnValue(true);

    await request(app)
      .put('/api/recurring/1?workspaceId=3')
      .send({ isActive: true });

    expect(requireWorkspaceMembership).toHaveBeenCalledWith(3, TEST_USER.id);
  });
});

describe('DELETE /api/recurring/:id', () => {
  it('returns 200 on success', async () => {
    vi.mocked(deletePattern).mockReturnValue(true);

    const res = await request(app).delete('/api/recurring/1?workspaceId=1');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true });
  });

  it('returns 400 when id is NaN', async () => {
    const res = await request(app).delete('/api/recurring/abc?workspaceId=1');

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 when workspaceId is missing', async () => {
    const res = await request(app).delete('/api/recurring/1');

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 404 when pattern not found', async () => {
    vi.mocked(deletePattern).mockReturnValue(false);

    const res = await request(app).delete('/api/recurring/999?workspaceId=1');

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('passes id and userId to service', async () => {
    vi.mocked(deletePattern).mockReturnValue(true);

    await request(app).delete('/api/recurring/5?workspaceId=1');

    expect(deletePattern).toHaveBeenCalledWith(5, TEST_USER.id);
  });

  it('checks workspace membership', async () => {
    vi.mocked(deletePattern).mockReturnValue(true);

    await request(app).delete('/api/recurring/1?workspaceId=3');

    expect(requireWorkspaceMembership).toHaveBeenCalledWith(3, TEST_USER.id);
  });
});

describe('GET /api/recurring/:id/transactions', () => {
  it('returns 200 with transactions', async () => {
    const transactions = [{ id: 1, description: 'Netflix' }];
    vi.mocked(getPatternTransactions).mockReturnValue(transactions as any);

    const res = await request(app).get('/api/recurring/1/transactions?workspaceId=1');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, data: transactions });
  });

  it('returns 400 when workspaceId is missing', async () => {
    const res = await request(app).get('/api/recurring/1/transactions');

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 when id is NaN', async () => {
    const res = await request(app).get('/api/recurring/abc/transactions?workspaceId=1');

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('checks workspace membership', async () => {
    vi.mocked(getPatternTransactions).mockReturnValue([]);

    await request(app).get('/api/recurring/1/transactions?workspaceId=3');

    expect(requireWorkspaceMembership).toHaveBeenCalledWith(3, TEST_USER.id);
  });

  it('passes patternId and workspaceId to service', async () => {
    vi.mocked(getPatternTransactions).mockReturnValue([]);

    await request(app).get('/api/recurring/5/transactions?workspaceId=2');

    expect(getPatternTransactions).toHaveBeenCalledWith(5, 2);
  });
});
