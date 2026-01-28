import { describe, it, expect } from 'vitest';
import request from 'supertest';
import express from 'express';
import { z } from 'zod';
import { validate, formatZodError } from './validate.js';
import { errorHandler } from './errorHandler.js';

function createApp(schemas: Parameters<typeof validate>[0], method: 'post' | 'get' = 'post') {
  const app = express();
  app.use(express.json());

  if (method === 'post') {
    app.post('/test', validate(schemas), (_req, res) => {
      res.json({ body: _req.body, params: _req.params, query: _req.query });
    });
  } else {
    app.get('/test/:id', validate(schemas), (_req, res) => {
      res.json({ body: _req.body, params: _req.params, query: _req.query });
    });
  }

  app.use(errorHandler);
  return app;
}

describe('validate middleware', () => {
  it('passes valid body through', async () => {
    const schema = z.object({ name: z.string() });
    const app = createApp({ body: schema });

    const res = await request(app)
      .post('/test')
      .send({ name: 'hello' });

    expect(res.status).toBe(200);
    expect(res.body.body).toEqual({ name: 'hello' });
  });

  it('returns 400 on invalid body', async () => {
    const schema = z.object({ name: z.string() });
    const app = createApp({ body: schema });

    const res = await request(app)
      .post('/test')
      .send({ name: 123 });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 on invalid params', async () => {
    const schema = z.object({ id: z.coerce.number().int().positive() });
    const app = createApp({ params: schema }, 'get');

    const res = await request(app).get('/test/abc');

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('strips unknown keys from body', async () => {
    const schema = z.object({ name: z.string() });
    const app = createApp({ body: schema });

    const res = await request(app)
      .post('/test')
      .send({ name: 'hello', extra: 'field' });

    expect(res.status).toBe(200);
    expect(res.body.body).toEqual({ name: 'hello' });
    expect(res.body.body.extra).toBeUndefined();
  });

  it('error message includes field names', async () => {
    const schema = z.object({ email: z.string().email() });
    const app = createApp({ body: schema });

    const res = await request(app)
      .post('/test')
      .send({ email: 'not-an-email' });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('email');
  });
});

describe('formatZodError', () => {
  it('formats single issue', () => {
    const schema = z.object({ name: z.string() });
    const result = schema.safeParse({ name: 123 });
    if (!result.success) {
      const formatted = formatZodError(result.error);
      expect(formatted).toContain('name');
    }
  });

  it('formats multiple issues', () => {
    const schema = z.object({ name: z.string(), age: z.number() });
    const result = schema.safeParse({ name: 123, age: 'old' });
    if (!result.success) {
      const formatted = formatZodError(result.error);
      expect(formatted).toContain('name');
      expect(formatted).toContain('age');
    }
  });
});
