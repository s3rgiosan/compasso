import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { createTestApp, TEST_USER } from './test-helpers.js';
import { AppError } from '../errors.js';

vi.mock('fs', () => ({
  default: {
    existsSync: vi.fn(() => true),
    mkdirSync: vi.fn(),
  },
  existsSync: vi.fn(() => true),
  mkdirSync: vi.fn(),
}));

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

vi.mock('../services/uploadService.js', () => ({
  processUpload: vi.fn(),
  listLedgers: vi.fn(),
  deleteLedger: vi.fn(),
}));

import router from './upload.js';
import { processUpload, listLedgers, deleteLedger } from '../services/uploadService.js';
import { requireWorkspaceMembership } from '../services/workspaceService.js';

const app = createTestApp(router, '/api/upload');

beforeEach(() => {
  vi.clearAllMocks();
});

describe('POST /api/upload', () => {
  it('returns 200 with upload result', async () => {
    const uploadResult = { ledgerId: 1, transactions: 10 };
    vi.mocked(processUpload).mockResolvedValue(uploadResult as any);

    const res = await request(app)
      .post('/api/upload?workspaceId=1')
      .attach('file', Buffer.from('%PDF-fake-content'), {
        filename: 'statement.pdf',
        contentType: 'application/pdf',
      });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, data: uploadResult });
  });

  it('returns 400 when no file is uploaded', async () => {
    const res = await request(app)
      .post('/api/upload?workspaceId=1');

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 when workspaceId is missing', async () => {
    const res = await request(app)
      .post('/api/upload')
      .attach('file', Buffer.from('%PDF-fake-content'), {
        filename: 'statement.pdf',
        contentType: 'application/pdf',
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('defaults bank to novo_banco', async () => {
    vi.mocked(processUpload).mockResolvedValue({} as any);

    await request(app)
      .post('/api/upload?workspaceId=1')
      .attach('file', Buffer.from('%PDF-fake-content'), {
        filename: 'statement.pdf',
        contentType: 'application/pdf',
      });

    expect(processUpload).toHaveBeenCalledWith(
      expect.any(Buffer),
      'statement.pdf',
      'novo_banco',
      1,
    );
  });

  it('returns 400 when file content is not a valid PDF', async () => {
    const res = await request(app)
      .post('/api/upload?workspaceId=1')
      .attach('file', Buffer.from('not-a-pdf-file'), {
        filename: 'statement.pdf',
        contentType: 'application/pdf',
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('uses provided bank param', async () => {
    vi.mocked(processUpload).mockResolvedValue({} as any);

    await request(app)
      .post('/api/upload?workspaceId=1&bank=caixa_geral')
      .attach('file', Buffer.from('%PDF-fake-content'), {
        filename: 'statement.pdf',
        contentType: 'application/pdf',
      });

    expect(processUpload).toHaveBeenCalledWith(
      expect.any(Buffer),
      'statement.pdf',
      'caixa_geral',
      1,
    );
  });

  it('checks workspace membership', async () => {
    vi.mocked(processUpload).mockResolvedValue({} as any);

    await request(app)
      .post('/api/upload?workspaceId=2')
      .attach('file', Buffer.from('%PDF-fake-content'), {
        filename: 'statement.pdf',
        contentType: 'application/pdf',
      });

    expect(requireWorkspaceMembership).toHaveBeenCalledWith(2, TEST_USER.id);
  });
});

describe('GET /api/upload/ledgers', () => {
  it('returns 200 with ledger list', async () => {
    const result = { items: [{ id: 1 }], total: 1 };
    vi.mocked(listLedgers).mockReturnValue(result as any);

    const res = await request(app).get('/api/upload/ledgers?workspaceId=1');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, data: result });
  });

  it('defaults limit to 20 and offset to 0', async () => {
    vi.mocked(listLedgers).mockReturnValue({ items: [], total: 0 } as any);

    await request(app).get('/api/upload/ledgers?workspaceId=1');

    expect(listLedgers).toHaveBeenCalledWith(1, 20, 0);
  });

  it('uses custom limit and offset', async () => {
    vi.mocked(listLedgers).mockReturnValue({ items: [], total: 0 } as any);

    await request(app).get('/api/upload/ledgers?workspaceId=1&limit=10&offset=5');

    expect(listLedgers).toHaveBeenCalledWith(1, 10, 5);
  });

  it('returns 400 when workspaceId is missing', async () => {
    const res = await request(app).get('/api/upload/ledgers');

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('checks workspace membership', async () => {
    vi.mocked(listLedgers).mockReturnValue({ items: [], total: 0 } as any);

    await request(app).get('/api/upload/ledgers?workspaceId=3');

    expect(requireWorkspaceMembership).toHaveBeenCalledWith(3, TEST_USER.id);
  });
});

describe('GET /api/upload/banks', () => {
  it('returns 200 with bank configs', async () => {
    const res = await request(app).get('/api/upload/banks');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    // Each bank should have id, name, country, currency
    for (const bank of res.body.data) {
      expect(bank).toHaveProperty('id');
      expect(bank).toHaveProperty('name');
      expect(bank).toHaveProperty('country');
      expect(bank).toHaveProperty('currency');
    }
  });
});

describe('DELETE /api/upload/ledgers/:id', () => {
  it('returns 200 on success', async () => {
    vi.mocked(deleteLedger).mockReturnValue(undefined as any);

    const res = await request(app).delete('/api/upload/ledgers/1');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true });
  });

  it('passes id and userId to service', async () => {
    vi.mocked(deleteLedger).mockReturnValue(undefined as any);

    await request(app).delete('/api/upload/ledgers/42');

    expect(deleteLedger).toHaveBeenCalledWith(42, TEST_USER.id);
  });

  it('returns 400 for non-numeric id', async () => {
    const res = await request(app).delete('/api/upload/ledgers/abc');

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('propagates not-found error', async () => {
    vi.mocked(deleteLedger).mockImplementation(() => {
      throw AppError.notFound('Ledger not found');
    });

    const res = await request(app).delete('/api/upload/ledgers/999');

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });
});
