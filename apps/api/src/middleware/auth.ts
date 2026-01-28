import { Request, Response, NextFunction } from 'express';
import { getDatabase } from '../db/database.js';
import { ErrorCode, DEFAULT_LOCALE, type User, type SupportedLocale } from '@compasso/shared';

// Extend Express Request to include user
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: User;
      sessionId?: string;
    }
  }
}

interface DbUser {
  id: number;
  username: string;
  email: string | null;
  display_name: string | null;
  locale: string | null;
  created_at: string;
}

interface DbSession {
  id: string;
  user_id: number;
  expires_at: string;
}

/**
 * Authentication middleware that validates session and attaches user to request.
 * Sessions can be provided via:
 * - Cookie: session_id
 * - Header: Authorization: Bearer <session_id>
 */
export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  try {
    const db = getDatabase();

    // Get session ID from cookie or Authorization header
    let sessionId = req.cookies?.session_id;

    if (!sessionId) {
      const authHeader = req.headers.authorization;
      if (authHeader?.startsWith('Bearer ')) {
        sessionId = authHeader.slice(7);
      }
    }

    if (!sessionId) {
      res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: ErrorCode.AUTH_REQUIRED,
      });
      return;
    }

    // Validate session
    const session = db
      .prepare(
        `
        SELECT id, user_id, expires_at
        FROM sessions
        WHERE id = ? AND expires_at > datetime('now')
      `
      )
      .get(sessionId) as DbSession | undefined;

    if (!session) {
      res.status(401).json({
        success: false,
        error: 'Invalid or expired session',
        code: ErrorCode.SESSION_EXPIRED,
      });
      return;
    }

    // Get user
    const user = db
      .prepare(
        `
        SELECT id, username, email, display_name, locale, created_at
        FROM users
        WHERE id = ?
      `
      )
      .get(session.user_id) as DbUser | undefined;

    if (!user) {
      res.status(401).json({
        success: false,
        error: 'User not found',
        code: ErrorCode.AUTH_REQUIRED,
      });
      return;
    }

    // Attach user to request
    req.user = {
      id: user.id,
      username: user.username,
      email: user.email,
      displayName: user.display_name,
      locale: (user.locale as SupportedLocale) || DEFAULT_LOCALE,
      createdAt: user.created_at,
    };
    req.sessionId = sessionId;

    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({
      success: false,
      error: 'Authentication error',
      code: ErrorCode.INTERNAL_ERROR,
    });
  }
}

