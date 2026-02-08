import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import request from 'supertest';
import { createTestApp, TEST_USER } from './test-helpers.js';
import { AppError } from '../errors.js';
import type { AuthResult } from '../services/authService.js';
import type { User } from '@compasso/shared';

vi.mock('../middleware/auth.js', () => ({
  authMiddleware: vi.fn((req: Request, _res: Response, next: NextFunction) => {
    req.user = TEST_USER;
    req.sessionId = 'test-session-id';
    next();
  }),
}));

vi.mock('../services/authService.js', () => ({
  registerUser: vi.fn(),
  loginUser: vi.fn(),
  logoutUser: vi.fn(),
  updateProfile: vi.fn(),
  changePassword: vi.fn(),
  SESSION_DURATION_DAYS: 30,
}));

vi.mock('../services/passwordResetService.js', () => ({
  requestPasswordReset: vi.fn().mockResolvedValue(undefined),
  resetPassword: vi.fn(),
}));

import router from './auth.js';
import {
  registerUser,
  loginUser,
  logoutUser,
  updateProfile,
  changePassword,
} from '../services/authService.js';
import { requestPasswordReset, resetPassword } from '../services/passwordResetService.js';

const app = createTestApp(router, '/api/auth');

beforeEach(() => {
  vi.clearAllMocks();
});

describe('POST /api/auth/register', () => {
  it('returns 201 with user and sessionId', async () => {
    const result = { user: { id: 1, username: 'new' }, sessionId: 'sess-1' };
    vi.mocked(registerUser).mockReturnValue(result as AuthResult);

    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'new', password: 'pass1234', email: 'new@test.com' });

    expect(res.status).toBe(201);
    expect(res.body).toEqual({ success: true, data: result });
  });

  it('sets session_id cookie', async () => {
    vi.mocked(registerUser).mockReturnValue({
      user: {},
      sessionId: 'cookie-sess',
    } as AuthResult);

    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'new', password: 'pass1234', email: 'new@test.com' });

    expect(res.headers['set-cookie']).toBeDefined();
    const cookie = res.headers['set-cookie']![0];
    expect(cookie).toContain('session_id=cookie-sess');
    expect(cookie).toContain('HttpOnly');
  });

  it('passes registration data to service', async () => {
    vi.mocked(registerUser).mockReturnValue({ user: {}, sessionId: 's' } as AuthResult);

    await request(app).post('/api/auth/register').send({
      username: 'usr',
      password: 'pass1234',
      email: 'e@e.com',
      displayName: 'D',
      locale: 'pt',
    });

    expect(registerUser).toHaveBeenCalledWith({
      username: 'usr',
      password: 'pass1234',
      email: 'e@e.com',
      displayName: 'D',
      locale: 'pt',
    });
  });

  it('propagates duplicate error', async () => {
    vi.mocked(registerUser).mockImplementation(() => {
      throw AppError.conflict('Username already exists');
    });

    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'dup', password: 'pass1234', email: 'dup@test.com' });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
  });
});

describe('POST /api/auth/login', () => {
  it('returns 200 with user and sessionId', async () => {
    const result = { user: { id: 1, username: 'test' }, sessionId: 'sess-2' };
    vi.mocked(loginUser).mockReturnValue(result as AuthResult);

    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'test', password: 'pass' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, data: result });
  });

  it('sets session_id cookie', async () => {
    vi.mocked(loginUser).mockReturnValue({
      user: {},
      sessionId: 'login-sess',
    } as AuthResult);

    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'test', password: 'pass' });

    const cookie = res.headers['set-cookie']![0];
    expect(cookie).toContain('session_id=login-sess');
  });

  it('propagates invalid-credentials error', async () => {
    vi.mocked(loginUser).mockImplementation(() => {
      throw AppError.unauthorized('Invalid credentials');
    });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'bad', password: 'wrong' });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });
});

describe('POST /api/auth/logout', () => {
  it('returns 200 and calls logoutUser', async () => {
    vi.mocked(logoutUser).mockReturnValue(undefined as never);

    const res = await request(app).post('/api/auth/logout');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true });
    expect(logoutUser).toHaveBeenCalledWith('test-session-id');
  });

  it('clears session_id cookie', async () => {
    vi.mocked(logoutUser).mockReturnValue(undefined as never);

    const res = await request(app).post('/api/auth/logout');

    const cookie = res.headers['set-cookie']![0];
    expect(cookie).toContain('session_id=');
    // Express clears cookies by setting expires in the past
    expect(cookie).toMatch(/Expires=Thu, 01 Jan 1970/);
  });
});

describe('GET /api/auth/me', () => {
  it('returns 200 with current user', async () => {
    const res = await request(app).get('/api/auth/me');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, data: TEST_USER });
  });
});

describe('PUT /api/auth/profile', () => {
  it('returns 200 with updated user', async () => {
    const updated = { ...TEST_USER, displayName: 'New Name' };
    vi.mocked(updateProfile).mockReturnValue(updated as User);

    const res = await request(app)
      .put('/api/auth/profile')
      .send({ displayName: 'New Name', email: 'new@test.com' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, data: updated });
  });

  it('passes userId, displayName, email, and locale to service', async () => {
    vi.mocked(updateProfile).mockReturnValue({} as User);

    await request(app)
      .put('/api/auth/profile')
      .send({ displayName: 'D', email: 'e@e.com', locale: 'pt' });

    expect(updateProfile).toHaveBeenCalledWith(TEST_USER.id, {
      displayName: 'D',
      email: 'e@e.com',
      locale: 'pt',
    });
  });
});

describe('PUT /api/auth/password', () => {
  it('returns 200 on success', async () => {
    vi.mocked(changePassword).mockReturnValue(undefined as never);

    const res = await request(app)
      .put('/api/auth/password')
      .send({ currentPassword: 'oldpass12', newPassword: 'newpwd12' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true });
  });

  it('passes userId and passwords to service', async () => {
    vi.mocked(changePassword).mockReturnValue(undefined as never);

    await request(app)
      .put('/api/auth/password')
      .send({ currentPassword: 'oldpass12', newPassword: 'newpwd12' });

    expect(changePassword).toHaveBeenCalledWith(TEST_USER.id, 'oldpass12', 'newpwd12');
  });

  it('propagates incorrect-password error', async () => {
    vi.mocked(changePassword).mockImplementation(() => {
      throw AppError.unauthorized('Incorrect password');
    });

    const res = await request(app)
      .put('/api/auth/password')
      .send({ currentPassword: 'wrongpwd', newPassword: 'newpwd12' });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });
});

describe('POST /api/auth/forgot-password', () => {
  it('returns 200 with generic message', async () => {
    const res = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'test@example.com' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.message).toContain('password reset link');
    expect(requestPasswordReset).toHaveBeenCalled();
  });

  it('returns 400 on invalid email format', async () => {
    const res = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'not-an-email' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});

describe('POST /api/auth/reset-password', () => {
  it('returns 200 on successful reset', async () => {
    vi.mocked(resetPassword).mockReturnValue(undefined as never);

    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: 'valid-token', newPassword: 'newpass1234' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.message).toContain('reset successfully');
  });

  it('returns 400 on invalid token', async () => {
    vi.mocked(resetPassword).mockImplementation(() => {
      throw AppError.badRequest('Invalid or expired reset token');
    });

    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: 'bad-token', newPassword: 'newpass1234' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 on validation error (missing token)', async () => {
    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({ newPassword: 'newpass1234' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});
