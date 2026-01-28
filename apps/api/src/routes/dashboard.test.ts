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

vi.mock('../services/dashboardService.js', () => ({
  getDashboardData: vi.fn(),
  getAvailableYears: vi.fn(),
}));

import router from './dashboard.js';
import { getDashboardData, getAvailableYears } from '../services/dashboardService.js';
import { requireWorkspaceMembership } from '../services/workspaceService.js';

const app = createTestApp(router, '/api/dashboard');

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/dashboard', () => {
  it('returns 200 with dashboard data', async () => {
    const data = { totalIncome: 1000, totalExpenses: 500 };
    vi.mocked(getDashboardData).mockReturnValue(data as any);

    const res = await request(app).get('/api/dashboard?workspaceId=1');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, data });
  });

  it('returns 400 when workspaceId is missing', async () => {
    const res = await request(app).get('/api/dashboard');

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('passes optional year, month, and categoryId', async () => {
    vi.mocked(getDashboardData).mockReturnValue({} as any);

    await request(app).get('/api/dashboard?workspaceId=1&year=2024&month=6&categoryId=3');

    expect(getDashboardData).toHaveBeenCalledWith({
      workspaceId: 1,
      year: 2024,
      month: 6,
      categoryId: 3,
    });
  });

  it('passes undefined for omitted optional params', async () => {
    vi.mocked(getDashboardData).mockReturnValue({} as any);

    await request(app).get('/api/dashboard?workspaceId=1');

    expect(getDashboardData).toHaveBeenCalledWith({
      workspaceId: 1,
      year: undefined,
      month: undefined,
      categoryId: undefined,
    });
  });

  it('checks workspace membership', async () => {
    vi.mocked(getDashboardData).mockReturnValue({} as any);

    await request(app).get('/api/dashboard?workspaceId=3');

    expect(requireWorkspaceMembership).toHaveBeenCalledWith(3, TEST_USER.id);
  });
});

describe('GET /api/dashboard/years', () => {
  it('returns 200 with available years', async () => {
    const years = [2023, 2024];
    vi.mocked(getAvailableYears).mockReturnValue(years as any);

    const res = await request(app).get('/api/dashboard/years?workspaceId=1');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, data: years });
  });

  it('returns 400 when workspaceId is missing', async () => {
    const res = await request(app).get('/api/dashboard/years');

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('passes workspaceId to service', async () => {
    vi.mocked(getAvailableYears).mockReturnValue([]);

    await request(app).get('/api/dashboard/years?workspaceId=5');

    expect(getAvailableYears).toHaveBeenCalledWith(5);
  });

  it('checks workspace membership', async () => {
    vi.mocked(getAvailableYears).mockReturnValue([]);

    await request(app).get('/api/dashboard/years?workspaceId=4');

    expect(requireWorkspaceMembership).toHaveBeenCalledWith(4, TEST_USER.id);
  });
});
