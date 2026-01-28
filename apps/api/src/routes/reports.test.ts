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

vi.mock('../services/reportsService.js', () => ({
  getYearlySummary: vi.fn(),
  getCategoryTrends: vi.fn(),
  getAvailableYearsForReports: vi.fn(),
}));

import router from './reports.js';
import {
  getYearlySummary,
  getCategoryTrends,
  getAvailableYearsForReports,
} from '../services/reportsService.js';
import { requireWorkspaceMembership } from '../services/workspaceService.js';

const app = createTestApp(router, '/api/reports');

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/reports/years', () => {
  it('returns 200 with available years', async () => {
    const years = [2023, 2024];
    vi.mocked(getAvailableYearsForReports).mockReturnValue(years as any);

    const res = await request(app).get('/api/reports/years?workspaceId=1');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, data: years });
  });

  it('returns 400 when workspaceId is missing', async () => {
    const res = await request(app).get('/api/reports/years');

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('passes workspaceId to service', async () => {
    vi.mocked(getAvailableYearsForReports).mockReturnValue([]);

    await request(app).get('/api/reports/years?workspaceId=3');

    expect(getAvailableYearsForReports).toHaveBeenCalledWith(3);
  });

  it('checks workspace membership', async () => {
    vi.mocked(getAvailableYearsForReports).mockReturnValue([]);

    await request(app).get('/api/reports/years?workspaceId=2');

    expect(requireWorkspaceMembership).toHaveBeenCalledWith(2, TEST_USER.id);
  });
});

describe('GET /api/reports/yearly', () => {
  it('returns 200 with yearly summary', async () => {
    const summary = { total: 5000 };
    vi.mocked(getYearlySummary).mockReturnValue(summary as any);

    const res = await request(app).get('/api/reports/yearly?workspaceId=1&year=2024');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, data: summary });
  });

  it('returns 400 when workspaceId is missing', async () => {
    const res = await request(app).get('/api/reports/yearly?year=2024');

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 when year is missing', async () => {
    const res = await request(app).get('/api/reports/yearly?workspaceId=1');

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('passes workspaceId and year to service', async () => {
    vi.mocked(getYearlySummary).mockReturnValue({} as any);

    await request(app).get('/api/reports/yearly?workspaceId=2&year=2023');

    expect(getYearlySummary).toHaveBeenCalledWith(2, 2023);
  });

  it('checks workspace membership', async () => {
    vi.mocked(getYearlySummary).mockReturnValue({} as any);

    await request(app).get('/api/reports/yearly?workspaceId=5&year=2024');

    expect(requireWorkspaceMembership).toHaveBeenCalledWith(5, TEST_USER.id);
  });
});

describe('GET /api/reports/category-trends', () => {
  it('returns 200 with trends data', async () => {
    const trends = [{ category: 'Food', total: 300 }];
    vi.mocked(getCategoryTrends).mockReturnValue(trends as any);

    const res = await request(app).get('/api/reports/category-trends?workspaceId=1');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, data: trends });
  });

  it('defaults months to 12', async () => {
    vi.mocked(getCategoryTrends).mockReturnValue([] as any);

    await request(app).get('/api/reports/category-trends?workspaceId=1');

    expect(getCategoryTrends).toHaveBeenCalledWith(1, 12);
  });

  it('uses custom months value', async () => {
    vi.mocked(getCategoryTrends).mockReturnValue([] as any);

    await request(app).get('/api/reports/category-trends?workspaceId=1&months=6');

    expect(getCategoryTrends).toHaveBeenCalledWith(1, 6);
  });

  it('returns 400 when workspaceId is missing', async () => {
    const res = await request(app).get('/api/reports/category-trends');

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('checks workspace membership', async () => {
    vi.mocked(getCategoryTrends).mockReturnValue([] as any);

    await request(app).get('/api/reports/category-trends?workspaceId=3');

    expect(requireWorkspaceMembership).toHaveBeenCalledWith(3, TEST_USER.id);
  });
});
