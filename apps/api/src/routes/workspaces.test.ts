import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { createTestApp, TEST_USER } from './test-helpers.js';
import { AppError } from '../errors.js';

vi.mock('../middleware/auth.js', () => ({
  authMiddleware: vi.fn((_req: any, _res: any, next: any) => {
    _req.user = TEST_USER;
    _req.sessionId = 'test-session-id';
    next();
  }),
}));

vi.mock('../services/workspaceManagementService.js', () => ({
  listUserWorkspaces: vi.fn(),
  getWorkspace: vi.fn(),
  createWorkspace: vi.fn(),
  updateWorkspace: vi.fn(),
  deleteWorkspace: vi.fn(),
}));

import router from './workspaces.js';
import {
  listUserWorkspaces,
  getWorkspace,
  createWorkspace,
  updateWorkspace,
  deleteWorkspace,
} from '../services/workspaceManagementService.js';

const app = createTestApp(router, '/api/workspaces');

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/workspaces', () => {
  it('returns 200 with workspace list', async () => {
    const workspaces = [{ id: 1, name: 'My Workspace' }];
    vi.mocked(listUserWorkspaces).mockReturnValue(workspaces as any);

    const res = await request(app).get('/api/workspaces');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, data: workspaces });
  });

  it('passes user.id to service', async () => {
    vi.mocked(listUserWorkspaces).mockReturnValue([]);

    await request(app).get('/api/workspaces');

    expect(listUserWorkspaces).toHaveBeenCalledWith(TEST_USER.id);
  });
});

describe('GET /api/workspaces/:id', () => {
  it('returns 200 with workspace', async () => {
    const workspace = { id: 1, name: 'My Workspace' };
    vi.mocked(getWorkspace).mockReturnValue(workspace as any);

    const res = await request(app).get('/api/workspaces/1');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, data: workspace });
  });

  it('parses :id as int and passes user.id', async () => {
    vi.mocked(getWorkspace).mockReturnValue({} as any);

    await request(app).get('/api/workspaces/42');

    expect(getWorkspace).toHaveBeenCalledWith(42, TEST_USER.id);
  });

  it('returns 404 when workspace not found', async () => {
    vi.mocked(getWorkspace).mockImplementation(() => {
      throw AppError.notFound('Workspace not found');
    });

    const res = await request(app).get('/api/workspaces/999');

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });
});

describe('POST /api/workspaces', () => {
  it('returns 201 with created workspace', async () => {
    const created = { id: 1, name: 'New' };
    vi.mocked(createWorkspace).mockReturnValue(created as any);

    const res = await request(app)
      .post('/api/workspaces')
      .send({ name: 'New', color: '#fff', icon: 'star' });

    expect(res.status).toBe(201);
    expect(res.body).toEqual({ success: true, data: created });
  });

  it('passes user.id and body to service', async () => {
    vi.mocked(createWorkspace).mockReturnValue({} as any);
    const body = { name: 'New', color: '#fff', icon: 'star' };

    await request(app).post('/api/workspaces').send(body);

    expect(createWorkspace).toHaveBeenCalledWith(TEST_USER.id, body);
  });
});

describe('PUT /api/workspaces/:id', () => {
  it('returns 200 on success', async () => {
    vi.mocked(updateWorkspace).mockReturnValue(undefined as any);

    const res = await request(app)
      .put('/api/workspaces/1')
      .send({ name: 'Updated' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true });
  });

  it('propagates not-found error', async () => {
    vi.mocked(updateWorkspace).mockImplementation(() => {
      throw AppError.notFound('Workspace not found');
    });

    const res = await request(app)
      .put('/api/workspaces/999')
      .send({ name: 'Updated' });

    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/workspaces/:id', () => {
  it('returns 200 on success', async () => {
    vi.mocked(deleteWorkspace).mockReturnValue(undefined as any);

    const res = await request(app).delete('/api/workspaces/1');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true });
  });

  it('propagates not-found error', async () => {
    vi.mocked(deleteWorkspace).mockImplementation(() => {
      throw AppError.notFound('Workspace not found');
    });

    const res = await request(app).delete('/api/workspaces/999');

    expect(res.status).toBe(404);
  });

  it('propagates forbidden error', async () => {
    vi.mocked(deleteWorkspace).mockImplementation(() => {
      throw AppError.forbidden('Not allowed');
    });

    const res = await request(app).delete('/api/workspaces/1');

    expect(res.status).toBe(403);
  });
});
