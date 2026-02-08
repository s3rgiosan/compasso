import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import request from 'supertest';
import { createTestApp, TEST_USER } from './test-helpers.js';
import { AppError } from '../errors.js';
import type { Category, CategoryWithPatterns } from '@compasso/shared';

vi.mock('../middleware/auth.js', () => ({
  authMiddleware: vi.fn((req: Request, _res: Response, next: NextFunction) => {
    req.user = TEST_USER;
    req.sessionId = 'test-session-id';
    next();
  }),
}));

vi.mock('../services/workspaceService.js', () => ({
  requireWorkspaceMembership: vi.fn(),
}));

vi.mock('../services/categoryService.js', () => ({
  listCategories: vi.fn(),
  getCategoryWithPatterns: vi.fn(),
  checkPatternExists: vi.fn(),
  createCategory: vi.fn(),
  updateCategory: vi.fn(),
  deleteCategory: vi.fn(),
  createQuickPattern: vi.fn(),
  createPattern: vi.fn(),
  deletePattern: vi.fn(),
}));

import router from './categories.js';
import {
  listCategories,
  getCategoryWithPatterns,
  checkPatternExists,
  createCategory,
  updateCategory,
  deleteCategory,
  createQuickPattern,
  createPattern,
  deletePattern,
} from '../services/categoryService.js';
import { requireWorkspaceMembership } from '../services/workspaceService.js';

const app = createTestApp(router, '/api/categories');

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/categories', () => {
  it('returns 200 with category list', async () => {
    const result = { total: 2, limit: 50, offset: 0, items: [{ id: 1 }, { id: 2 }] };
    vi.mocked(listCategories).mockReturnValue(result as ReturnType<typeof listCategories>);

    const res = await request(app).get('/api/categories?workspaceId=1');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, data: result });
  });

  it('defaults limit to 50 and offset to 0', async () => {
    vi.mocked(listCategories).mockReturnValue({ items: [] } as unknown as ReturnType<typeof listCategories>);

    await request(app).get('/api/categories?workspaceId=1');

    expect(listCategories).toHaveBeenCalledWith(1, 50, 0);
  });

  it('uses custom limit and offset', async () => {
    vi.mocked(listCategories).mockReturnValue({ items: [] } as unknown as ReturnType<typeof listCategories>);

    await request(app).get('/api/categories?workspaceId=1&limit=10&offset=20');

    expect(listCategories).toHaveBeenCalledWith(1, 10, 20);
  });

  it('returns 400 when workspaceId is missing', async () => {
    const res = await request(app).get('/api/categories');

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('checks workspace membership', async () => {
    vi.mocked(listCategories).mockReturnValue({ items: [] } as unknown as ReturnType<typeof listCategories>);

    await request(app).get('/api/categories?workspaceId=1');

    expect(requireWorkspaceMembership).toHaveBeenCalledWith(1, TEST_USER.id);
  });
});

describe('GET /api/categories/:id', () => {
  it('returns 200 with category', async () => {
    const category = { id: 1, name: 'Food', patterns: [] };
    vi.mocked(getCategoryWithPatterns).mockReturnValue(category as unknown as CategoryWithPatterns);

    const res = await request(app).get('/api/categories/1?workspaceId=1');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, data: category });
  });

  it('passes optional bankId', async () => {
    vi.mocked(getCategoryWithPatterns).mockReturnValue({} as CategoryWithPatterns);

    await request(app).get('/api/categories/1?workspaceId=1&bank=novo_banco');

    expect(getCategoryWithPatterns).toHaveBeenCalledWith(1, 1, 'novo_banco');
  });

  it('passes undefined when bankId is omitted', async () => {
    vi.mocked(getCategoryWithPatterns).mockReturnValue({} as CategoryWithPatterns);

    await request(app).get('/api/categories/1?workspaceId=1');

    expect(getCategoryWithPatterns).toHaveBeenCalledWith(1, 1, undefined);
  });

  it('propagates not-found error', async () => {
    vi.mocked(getCategoryWithPatterns).mockImplementation(() => {
      throw AppError.notFound('Category not found');
    });

    const res = await request(app).get('/api/categories/999?workspaceId=1');

    expect(res.status).toBe(404);
  });

  it('checks workspace membership', async () => {
    vi.mocked(getCategoryWithPatterns).mockReturnValue({} as CategoryWithPatterns);

    await request(app).get('/api/categories/1?workspaceId=2');

    expect(requireWorkspaceMembership).toHaveBeenCalledWith(2, TEST_USER.id);
  });
});

describe('GET /api/categories/patterns/exists', () => {
  it('returns 200 with existence result', async () => {
    vi.mocked(checkPatternExists).mockReturnValue({ exists: true });

    const res = await request(app).get(
      '/api/categories/patterns/exists?workspaceId=1&bankId=novo_banco&pattern=test',
    );

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, data: { exists: true } });
  });

  it('returns 400 when bankId is missing', async () => {
    const res = await request(app).get(
      '/api/categories/patterns/exists?workspaceId=1&pattern=test',
    );

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 when pattern is missing', async () => {
    const res = await request(app).get(
      '/api/categories/patterns/exists?workspaceId=1&bankId=novo_banco',
    );

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('checks workspace membership', async () => {
    vi.mocked(checkPatternExists).mockReturnValue({ exists: true });

    await request(app).get(
      '/api/categories/patterns/exists?workspaceId=3&bankId=novo_banco&pattern=test',
    );

    expect(requireWorkspaceMembership).toHaveBeenCalledWith(3, TEST_USER.id);
  });
});

describe('POST /api/categories', () => {
  it('returns 201 with created category', async () => {
    const category = { id: 1, name: 'New' };
    vi.mocked(createCategory).mockReturnValue(category as Category);

    const res = await request(app)
      .post('/api/categories')
      .send({ name: 'New', color: '#fff', icon: 'star', workspaceId: 1 });

    expect(res.status).toBe(201);
    expect(res.body).toEqual({ success: true, data: category });
  });

  it('returns 400 when workspaceId is missing', async () => {
    const res = await request(app)
      .post('/api/categories')
      .send({ name: 'New', color: '#fff' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('passes category data to service', async () => {
    vi.mocked(createCategory).mockReturnValue({} as Category);

    await request(app)
      .post('/api/categories')
      .send({ name: 'Food', color: '#f00', icon: 'utensils', workspaceId: 3 });

    expect(createCategory).toHaveBeenCalledWith({
      name: 'Food',
      color: '#f00',
      icon: 'utensils',
      workspaceId: 3,
    });
  });

  it('checks workspace membership', async () => {
    vi.mocked(createCategory).mockReturnValue({} as Category);

    await request(app)
      .post('/api/categories')
      .send({ name: 'New', color: '#fff', icon: 'star', workspaceId: 2 });

    expect(requireWorkspaceMembership).toHaveBeenCalledWith(2, TEST_USER.id);
  });
});

describe('PUT /api/categories/:id', () => {
  it('returns 200 on success', async () => {
    vi.mocked(updateCategory).mockReturnValue(undefined as never);

    const res = await request(app)
      .put('/api/categories/1')
      .send({ name: 'Updated', workspaceId: 1 });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true });
  });

  it('returns 400 when workspaceId is missing', async () => {
    const res = await request(app)
      .put('/api/categories/1')
      .send({ name: 'Updated' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('passes id, workspaceId, and update data to service', async () => {
    vi.mocked(updateCategory).mockReturnValue(undefined as never);

    await request(app)
      .put('/api/categories/5')
      .send({ name: 'N', color: '#000', icon: 'x', workspaceId: 2 });

    expect(updateCategory).toHaveBeenCalledWith(5, 2, {
      name: 'N',
      color: '#000',
      icon: 'x',
    });
  });

  it('checks workspace membership', async () => {
    vi.mocked(updateCategory).mockReturnValue(undefined as never);

    await request(app)
      .put('/api/categories/1')
      .send({ name: 'Updated', workspaceId: 4 });

    expect(requireWorkspaceMembership).toHaveBeenCalledWith(4, TEST_USER.id);
  });
});

describe('DELETE /api/categories/:id', () => {
  it('returns 200 on success', async () => {
    vi.mocked(deleteCategory).mockReturnValue(undefined as never);

    const res = await request(app).delete('/api/categories/1?workspaceId=1');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true });
  });

  it('passes id and workspaceId to service', async () => {
    vi.mocked(deleteCategory).mockReturnValue(undefined as never);

    await request(app).delete('/api/categories/5?workspaceId=3');

    expect(deleteCategory).toHaveBeenCalledWith(5, 3);
  });

  it('returns 400 when workspaceId is missing', async () => {
    const res = await request(app).delete('/api/categories/1');

    expect(res.status).toBe(400);
  });

  it('checks workspace membership', async () => {
    vi.mocked(deleteCategory).mockReturnValue(undefined as never);

    await request(app).delete('/api/categories/1?workspaceId=3');

    expect(requireWorkspaceMembership).toHaveBeenCalledWith(3, TEST_USER.id);
  });
});

describe('POST /api/categories/:id/patterns/quick', () => {
  it('returns 201 with patternId and appliedCount', async () => {
    vi.mocked(createQuickPattern).mockReturnValue(10);

    const res = await request(app)
      .post('/api/categories/1/patterns/quick')
      .send({
        pattern: 'test',
        bankId: 'novo_banco',
        workspaceId: 1,
        transactionIndices: [0, 1, 2],
      });

    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      success: true,
      data: { patternId: 10, appliedCount: 3 },
    });
  });

  it('defaults appliedCount to 0 when transactionIndices is omitted', async () => {
    vi.mocked(createQuickPattern).mockReturnValue(10);

    const res = await request(app)
      .post('/api/categories/1/patterns/quick')
      .send({ pattern: 'test', bankId: 'novo_banco', workspaceId: 1 });

    expect(res.body.data.appliedCount).toBe(0);
  });

  it('passes categoryId, workspaceId, bankId, pattern to service', async () => {
    vi.mocked(createQuickPattern).mockReturnValue(1);

    await request(app)
      .post('/api/categories/7/patterns/quick')
      .send({ pattern: 'pingo', bankId: 'nb', workspaceId: 3 });

    expect(createQuickPattern).toHaveBeenCalledWith(7, 3, 'nb', 'pingo');
  });

  it('checks workspace membership', async () => {
    vi.mocked(createQuickPattern).mockReturnValue(1);

    await request(app)
      .post('/api/categories/1/patterns/quick')
      .send({ pattern: 'test', bankId: 'nb', workspaceId: 5 });

    expect(requireWorkspaceMembership).toHaveBeenCalledWith(5, TEST_USER.id);
  });
});

describe('POST /api/categories/:id/patterns', () => {
  it('returns 201 with pattern data and recategorized count', async () => {
    vi.mocked(createPattern).mockReturnValue({
      patternId: 5,
      recategorized: 3,
    });

    const res = await request(app)
      .post('/api/categories/1/patterns')
      .send({
        bankId: 'novo_banco',
        pattern: 'test',
        workspaceId: 1,
        priority: 10,
      });

    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      success: true,
      data: {
        id: 5,
        categoryId: 1,
        bankId: 'novo_banco',
        pattern: 'test',
        priority: 10,
        recategorized: 3,
      },
    });
  });

  it('defaults priority to 0', async () => {
    vi.mocked(createPattern).mockReturnValue({
      patternId: 1,
      recategorized: 0,
    });

    const res = await request(app)
      .post('/api/categories/1/patterns')
      .send({ bankId: 'nb', pattern: 'p', workspaceId: 1 });

    expect(createPattern).toHaveBeenCalledWith(1, 1, 'nb', 'p', 0);
    expect(res.body.data.priority).toBe(0);
  });

  it('passes all params to service', async () => {
    vi.mocked(createPattern).mockReturnValue({
      patternId: 1,
      recategorized: 0,
    } as any);

    await request(app)
      .post('/api/categories/3/patterns')
      .send({ bankId: 'b', pattern: 'x', workspaceId: 2, priority: 5 });

    expect(createPattern).toHaveBeenCalledWith(3, 2, 'b', 'x', 5);
  });

  it('checks workspace membership', async () => {
    vi.mocked(createPattern).mockReturnValue({ patternId: 1, recategorized: 0 });

    await request(app)
      .post('/api/categories/1/patterns')
      .send({ bankId: 'nb', pattern: 'p', workspaceId: 6 });

    expect(requireWorkspaceMembership).toHaveBeenCalledWith(6, TEST_USER.id);
  });
});

describe('DELETE /api/categories/:id/patterns/:patternId', () => {
  it('returns 200 on success', async () => {
    vi.mocked(deletePattern).mockReturnValue(undefined as never);

    const res = await request(app).delete(
      '/api/categories/1/patterns/2?workspaceId=1',
    );

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true });
  });

  it('passes categoryId, patternId, and workspaceId to service', async () => {
    vi.mocked(deletePattern).mockReturnValue(undefined as never);

    await request(app).delete('/api/categories/5/patterns/10?workspaceId=3');

    expect(deletePattern).toHaveBeenCalledWith(5, 10, 3);
  });

  it('returns 400 when workspaceId is missing', async () => {
    const res = await request(app).delete('/api/categories/1/patterns/2');

    expect(res.status).toBe(400);
  });

  it('checks workspace membership', async () => {
    vi.mocked(deletePattern).mockReturnValue(undefined as never);

    await request(app).delete('/api/categories/1/patterns/2?workspaceId=4');

    expect(requireWorkspaceMembership).toHaveBeenCalledWith(4, TEST_USER.id);
  });
});
