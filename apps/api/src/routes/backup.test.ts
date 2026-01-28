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

vi.mock('../services/backupService.js', () => ({
  exportWorkspaceData: vi.fn(),
  importWorkspaceData: vi.fn(),
}));

vi.mock('../services/workspaceService.js', () => ({
  requireWorkspaceMembership: vi.fn(),
  requireWorkspaceRole: vi.fn(),
}));

import router from './backup.js';
import { exportWorkspaceData, importWorkspaceData } from '../services/backupService.js';
import { requireWorkspaceMembership, requireWorkspaceRole } from '../services/workspaceService.js';

const app = createTestApp(router, '/api/backup');

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/backup/export', () => {
  it('returns 200 with backup JSON and Content-Disposition header', async () => {
    const backup = {
      version: 1,
      workspace: { name: 'My Workspace' },
      categories: [],
      ledgers: [],
    };
    vi.mocked(exportWorkspaceData).mockReturnValue(backup as any);
    vi.mocked(requireWorkspaceMembership).mockReturnValue(undefined as any);

    const res = await request(app).get('/api/backup/export?workspaceId=1');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('application/json');
    expect(res.headers['content-disposition']).toContain('attachment');
    expect(res.headers['content-disposition']).toContain('compasso-backup-my-workspace');
  });

  it('returns 400 when workspaceId is missing', async () => {
    const res = await request(app).get('/api/backup/export');

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('calls requireWorkspaceMembership with workspaceId and userId', async () => {
    vi.mocked(exportWorkspaceData).mockReturnValue({
      workspace: { name: 'W' },
    } as any);
    vi.mocked(requireWorkspaceMembership).mockReturnValue(undefined as any);

    await request(app).get('/api/backup/export?workspaceId=5');

    expect(requireWorkspaceMembership).toHaveBeenCalledWith(5, TEST_USER.id);
  });

  it('passes workspaceId to exportWorkspaceData', async () => {
    vi.mocked(exportWorkspaceData).mockReturnValue({
      workspace: { name: 'W' },
    } as any);
    vi.mocked(requireWorkspaceMembership).mockReturnValue(undefined as any);

    await request(app).get('/api/backup/export?workspaceId=3');

    expect(exportWorkspaceData).toHaveBeenCalledWith(3);
  });
});

describe('POST /api/backup/import', () => {
  const validBackup = {
    version: 1,
    exportedAt: '2024-01-01T00:00:00.000Z',
    workspace: { name: 'W', description: null, color: '#000', icon: 'star' },
    categories: [],
    ledgers: [],
    recurringPatterns: [],
  };

  it('returns 200 with import stats', async () => {
    const stats = { categoriesImported: 5, ledgersImported: 2 };
    vi.mocked(requireWorkspaceRole).mockReturnValue(undefined as any);
    vi.mocked(importWorkspaceData).mockReturnValue(stats as any);

    const res = await request(app)
      .post('/api/backup/import?workspaceId=1')
      .attach('file', Buffer.from(JSON.stringify(validBackup)), {
        filename: 'backup.json',
        contentType: 'application/json',
      });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, data: stats });
  });

  it('returns 400 when no file is uploaded', async () => {
    const res = await request(app)
      .post('/api/backup/import?workspaceId=1');

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 on invalid JSON', async () => {
    vi.mocked(requireWorkspaceRole).mockReturnValue(undefined as any);

    const res = await request(app)
      .post('/api/backup/import?workspaceId=1')
      .attach('file', Buffer.from('not-valid-json'), {
        filename: 'backup.json',
        contentType: 'application/json',
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Invalid JSON');
  });

  it('returns 400 on bad version', async () => {
    vi.mocked(requireWorkspaceRole).mockReturnValue(undefined as any);
    const bad = { ...validBackup, version: 99 };

    const res = await request(app)
      .post('/api/backup/import?workspaceId=1')
      .attach('file', Buffer.from(JSON.stringify(bad)), {
        filename: 'backup.json',
        contentType: 'application/json',
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('version');
  });

  it('returns 400 on missing structure', async () => {
    vi.mocked(requireWorkspaceRole).mockReturnValue(undefined as any);
    const bad = { version: 1 };

    const res = await request(app)
      .post('/api/backup/import?workspaceId=1')
      .attach('file', Buffer.from(JSON.stringify(bad)), {
        filename: 'backup.json',
        contentType: 'application/json',
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('structure');
  });

  it('calls requireWorkspaceRole with owner/editor', async () => {
    vi.mocked(requireWorkspaceRole).mockReturnValue(undefined as any);
    vi.mocked(importWorkspaceData).mockReturnValue({} as any);

    await request(app)
      .post('/api/backup/import?workspaceId=5')
      .attach('file', Buffer.from(JSON.stringify(validBackup)), {
        filename: 'backup.json',
        contentType: 'application/json',
      });

    expect(requireWorkspaceRole).toHaveBeenCalledWith(5, TEST_USER.id, ['owner', 'editor']);
  });

  it('returns 400 when workspaceId is missing', async () => {
    const res = await request(app)
      .post('/api/backup/import')
      .attach('file', Buffer.from(JSON.stringify(validBackup)), {
        filename: 'backup.json',
        contentType: 'application/json',
      });

    expect(res.status).toBe(400);
  });
});
