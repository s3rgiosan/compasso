import crypto from 'crypto';
import { getDatabase } from '../db/database.js';
import { seedCategoriesForWorkspace } from '../db/seed.js';
import { AppError } from '../errors.js';
import { ErrorCode, DEFAULT_LOCALE, getLocalizedWorkspaceDefaults, type User, type SupportedLocale } from '@compasso/shared';

const SESSION_DURATION_DAYS = 30;

interface DbUser {
  id: number;
  username: string;
  password_hash: string;
  email: string | null;
  display_name: string | null;
  locale: string | null;
  created_at: string;
}

/**
 * Result returned by register and login operations, containing the user and session ID.
 */
export interface AuthResult {
  user: User;
  sessionId: string;
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, hash] = storedHash.split(':');
  const verifyHash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(verifyHash, 'hex'));
}

function generateSessionId(): string {
  return crypto.randomBytes(32).toString('hex');
}

function createSession(userId: number): string {
  const db = getDatabase();
  const sessionId = generateSessionId();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + SESSION_DURATION_DAYS);

  db.prepare(
    'INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)'
  ).run(sessionId, userId, expiresAt.toISOString());

  return sessionId;
}

/**
 * Register a new user, create default workspace with seeded categories, and start a session.
 */
export function registerUser(data: {
  username: string;
  password: string;
  email: string;
  displayName?: string;
  locale?: SupportedLocale;
}): AuthResult {
  const db = getDatabase();
  const locale = data.locale || DEFAULT_LOCALE;

  if (!data.username || !data.password) {
    throw AppError.badRequest('Username and password are required');
  }

  if (data.username.length < 3 || data.username.length > 50) {
    throw AppError.badRequest('Username must be between 3 and 50 characters');
  }

  if (!/^[a-zA-Z0-9_-]+$/.test(data.username)) {
    throw AppError.badRequest('Username can only contain letters, numbers, underscores, and hyphens');
  }

  if (data.password.length < 8) {
    throw AppError.badRequest('Password must be at least 8 characters');
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
    throw AppError.badRequest('Invalid email format');
  }

  const existingUser = db
    .prepare('SELECT id FROM users WHERE username = ?')
    .get(data.username);

  if (existingUser) {
    throw AppError.badRequest('Username already taken', ErrorCode.DUPLICATE_RESOURCE);
  }

  const existingEmail = db
    .prepare('SELECT id FROM users WHERE email = ?')
    .get(data.email);

  if (existingEmail) {
    throw AppError.badRequest('Email already registered', ErrorCode.DUPLICATE_RESOURCE);
  }

  const passwordHash = hashPassword(data.password);
  const result = db
    .prepare(
      'INSERT INTO users (username, password_hash, email, display_name, locale) VALUES (?, ?, ?, ?, ?)'
    )
    .run(data.username, passwordHash, data.email, data.displayName || null, locale);

  const userId = Number(result.lastInsertRowid);

  const sessionId = createSession(userId);

  // Create default workspace for user
  const workspace = getLocalizedWorkspaceDefaults(locale);
  const workspaceResult = db
    .prepare(
      'INSERT INTO workspaces (name, description, color, icon, is_default) VALUES (?, ?, ?, ?, 1)'
    )
    .run(workspace.name, workspace.description, '#6366f1', 'briefcase');

  const workspaceId = Number(workspaceResult.lastInsertRowid);

  db.prepare(
    'INSERT INTO workspace_members (workspace_id, user_id, role) VALUES (?, ?, ?)'
  ).run(workspaceId, userId, 'owner');

  // Seed default categories for the new workspace using shared constants
  seedCategoriesForWorkspace(workspaceId, locale);

  const user: User = {
    id: userId,
    username: data.username,
    email: data.email,
    displayName: data.displayName || null,
    locale,
    createdAt: new Date().toISOString(),
  };

  return { user, sessionId };
}

/**
 * Authenticate a user by username and password, and create a new session.
 */
export function loginUser(data: { username: string; password: string }): AuthResult {
  const db = getDatabase();

  if (!data.username || !data.password) {
    throw AppError.badRequest('Username and password are required');
  }

  const user = db
    .prepare(
      'SELECT id, username, password_hash, email, display_name, locale, created_at FROM users WHERE username = ?'
    )
    .get(data.username) as DbUser | undefined;

  if (!user) {
    throw AppError.unauthorized('Invalid username or password', ErrorCode.INVALID_CREDENTIALS);
  }

  if (!verifyPassword(data.password, user.password_hash)) {
    throw AppError.unauthorized('Invalid username or password', ErrorCode.INVALID_CREDENTIALS);
  }

  const sessionId = createSession(user.id);

  const responseUser: User = {
    id: user.id,
    username: user.username,
    email: user.email,
    displayName: user.display_name,
    locale: (user.locale as SupportedLocale) || DEFAULT_LOCALE,
    createdAt: user.created_at,
  };

  return { user: responseUser, sessionId };
}

/**
 * Destroy the given session.
 */
export function logoutUser(sessionId: string): void {
  const db = getDatabase();
  db.prepare('DELETE FROM sessions WHERE id = ?').run(sessionId);
}

/**
 * Update a user's profile (display name and/or email).
 */
export function updateProfile(
  userId: number,
  data: { displayName?: string; email?: string; locale?: SupportedLocale }
): User {
  const db = getDatabase();

  const updates: string[] = [];
  const params: unknown[] = [];

  if (data.displayName !== undefined) {
    updates.push('display_name = ?');
    params.push(data.displayName || null);
  }

  if (data.email !== undefined) {
    if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
      throw AppError.badRequest('Invalid email format');
    }

    if (data.email) {
      const existingEmail = db
        .prepare('SELECT id FROM users WHERE email = ? AND id != ?')
        .get(data.email, userId);

      if (existingEmail) {
        throw AppError.badRequest('Email already registered', ErrorCode.DUPLICATE_RESOURCE);
      }
    }

    updates.push('email = ?');
    params.push(data.email || null);
  }

  if (data.locale !== undefined) {
    updates.push('locale = ?');
    params.push(data.locale);
  }

  if (updates.length === 0) {
    throw AppError.badRequest('No fields to update');
  }

  params.push(userId);

  db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...params);

  const updatedUser = db
    .prepare(
      'SELECT id, username, email, display_name, locale, created_at FROM users WHERE id = ?'
    )
    .get(userId) as DbUser;

  return {
    id: updatedUser.id,
    username: updatedUser.username,
    email: updatedUser.email,
    displayName: updatedUser.display_name,
    locale: (updatedUser.locale as SupportedLocale) || DEFAULT_LOCALE,
    createdAt: updatedUser.created_at,
  };
}

/**
 * Change a user's password after verifying the current password.
 */
export function changePassword(
  userId: number,
  currentPassword: string,
  newPassword: string
): void {
  const db = getDatabase();

  if (!currentPassword || !newPassword) {
    throw AppError.badRequest('Current password and new password are required');
  }

  if (newPassword.length < 8) {
    throw AppError.badRequest('New password must be at least 8 characters');
  }

  const user = db
    .prepare('SELECT password_hash FROM users WHERE id = ?')
    .get(userId) as { password_hash: string } | undefined;

  if (!user) {
    throw AppError.notFound('User not found');
  }

  if (!verifyPassword(currentPassword, user.password_hash)) {
    throw AppError.unauthorized('Current password is incorrect', ErrorCode.INVALID_CREDENTIALS);
  }

  const newPasswordHash = hashPassword(newPassword);
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(newPasswordHash, userId);
}

/**
 * Session duration in days, used for cookie maxAge calculation.
 */
export function invalidateUserSessions(userId: number): void {
  const db = getDatabase();
  db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId);
}

/**
 * Delete all expired sessions from the database.
 */
export function cleanExpiredSessions(): number {
  const db = getDatabase();
  const result = db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(new Date().toISOString());
  return result.changes;
}

export { SESSION_DURATION_DAYS };
