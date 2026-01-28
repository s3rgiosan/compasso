import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { ErrorCode } from '@compasso/shared';

vi.mock('../db/database.js', () => ({
  getDatabase: vi.fn(),
}));

import { getDatabase } from '../db/database.js';
import { authMiddleware } from './auth.js';

describe('authMiddleware', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;
  const mockDb = { prepare: vi.fn() };

  beforeEach(() => {
    req = {
      cookies: {},
      headers: {},
    };
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    next = vi.fn();
    vi.mocked(getDatabase).mockReturnValue(mockDb as any);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should return 401 when no session ID is provided', () => {
    authMiddleware(req as Request, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: 'Authentication required',
      code: ErrorCode.AUTH_REQUIRED,
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('should extract session from cookie', () => {
    req.cookies = { session_id: 'test-session-123' };

    const mockSession = {
      id: 'test-session-123',
      user_id: 1,
      expires_at: new Date(Date.now() + 86400000).toISOString(),
    };
    const mockUser = {
      id: 1,
      username: 'testuser',
      email: 'test@example.com',
      display_name: 'Test User',
      locale: 'en',
      created_at: '2024-01-01T00:00:00.000Z',
    };

    mockDb.prepare.mockImplementation((sql: string) => {
      if (sql.includes('sessions')) {
        return { get: vi.fn().mockReturnValue(mockSession) };
      }
      if (sql.includes('users')) {
        return { get: vi.fn().mockReturnValue(mockUser) };
      }
      return { get: vi.fn().mockReturnValue(undefined) };
    });

    authMiddleware(req as Request, res as Response, next);

    expect(next).toHaveBeenCalled();
    expect(req.user).toEqual({
      id: 1,
      username: 'testuser',
      email: 'test@example.com',
      displayName: 'Test User',
      locale: 'en',
      createdAt: '2024-01-01T00:00:00.000Z',
    });
    expect(req.sessionId).toBe('test-session-123');
  });

  it('should extract session from Authorization header', () => {
    req.headers = { authorization: 'Bearer bearer-session-456' };

    const mockSession = {
      id: 'bearer-session-456',
      user_id: 2,
      expires_at: new Date(Date.now() + 86400000).toISOString(),
    };
    const mockUser = {
      id: 2,
      username: 'beareruser',
      email: null,
      display_name: null,
      locale: null,
      created_at: '2024-01-01T00:00:00.000Z',
    };

    mockDb.prepare.mockImplementation((sql: string) => {
      if (sql.includes('sessions')) {
        return { get: vi.fn().mockReturnValue(mockSession) };
      }
      if (sql.includes('users')) {
        return { get: vi.fn().mockReturnValue(mockUser) };
      }
      return { get: vi.fn().mockReturnValue(undefined) };
    });

    authMiddleware(req as Request, res as Response, next);

    expect(next).toHaveBeenCalled();
    expect(req.sessionId).toBe('bearer-session-456');
  });

  it('should return 401 when session is expired or not found', () => {
    req.cookies = { session_id: 'expired-session' };

    mockDb.prepare.mockReturnValue({
      get: vi.fn().mockReturnValue(undefined),
    });

    authMiddleware(req as Request, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: 'Invalid or expired session',
      code: ErrorCode.SESSION_EXPIRED,
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 401 when user is not found', () => {
    req.cookies = { session_id: 'orphan-session' };

    mockDb.prepare.mockImplementation((sql: string) => {
      if (sql.includes('sessions')) {
        return {
          get: vi.fn().mockReturnValue({
            id: 'orphan-session',
            user_id: 999,
            expires_at: new Date(Date.now() + 86400000).toISOString(),
          }),
        };
      }
      if (sql.includes('users')) {
        return { get: vi.fn().mockReturnValue(undefined) };
      }
      return { get: vi.fn().mockReturnValue(undefined) };
    });

    authMiddleware(req as Request, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: 'User not found',
      code: ErrorCode.AUTH_REQUIRED,
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('should prefer cookie over Authorization header', () => {
    req.cookies = { session_id: 'cookie-session' };
    req.headers = { authorization: 'Bearer header-session' };

    const mockSession = {
      id: 'cookie-session',
      user_id: 1,
      expires_at: new Date(Date.now() + 86400000).toISOString(),
    };
    const mockUser = {
      id: 1,
      username: 'testuser',
      email: null,
      display_name: null,
      locale: null,
      created_at: '2024-01-01T00:00:00.000Z',
    };

    mockDb.prepare.mockImplementation((sql: string) => {
      if (sql.includes('sessions')) {
        return { get: vi.fn().mockReturnValue(mockSession) };
      }
      if (sql.includes('users')) {
        return { get: vi.fn().mockReturnValue(mockUser) };
      }
      return { get: vi.fn().mockReturnValue(undefined) };
    });

    authMiddleware(req as Request, res as Response, next);

    expect(req.sessionId).toBe('cookie-session');
  });

  it('should return 500 when an unexpected error occurs', () => {
    req.cookies = { session_id: 'test-session' };

    vi.mocked(getDatabase).mockImplementation(() => {
      throw new Error('Database connection failed');
    });

    vi.spyOn(console, 'error').mockImplementation(() => {});

    authMiddleware(req as Request, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: 'Authentication error',
      code: ErrorCode.INTERNAL_ERROR,
    });
    expect(next).not.toHaveBeenCalled();
  });
});
