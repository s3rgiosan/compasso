import crypto from 'crypto';
import { getDatabase } from '../db/database.js';
import { AppError } from '../errors.js';
import { ErrorCode } from '@compasso/shared';
import { hashPassword, invalidateUserSessions } from './authService.js';
import { sendPasswordResetEmail } from './emailService.js';

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export async function requestPasswordReset(email: string, baseUrl: string): Promise<void> {
  const db = getDatabase();

  const user = db.prepare('SELECT id, email FROM users WHERE email = ?').get(email) as
    | { id: number; email: string }
    | undefined;

  if (!user) {
    // Do not reveal whether the email exists
    return;
  }

  // Delete old tokens for this user
  db.prepare('DELETE FROM password_reset_tokens WHERE user_id = ?').run(user.id);

  // Generate token
  const plainToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashToken(plainToken);

  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 1);

  db.prepare(
    'INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)'
  ).run(user.id, tokenHash, expiresAt.toISOString());

  const resetUrl = `${baseUrl}/reset-password?token=${plainToken}`;
  await sendPasswordResetEmail(user.email, resetUrl);
}

export function resetPassword(token: string, newPassword: string): void {
  const db = getDatabase();

  const tokenHash = hashToken(token);

  const row = db
    .prepare(
      `SELECT id, user_id FROM password_reset_tokens
       WHERE token_hash = ? AND used_at IS NULL AND expires_at > datetime('now')`
    )
    .get(tokenHash) as { id: number; user_id: number } | undefined;

  if (!row) {
    throw AppError.badRequest('Invalid or expired reset token', ErrorCode.INVALID_RESET_TOKEN);
  }

  const passwordHash = hashPassword(newPassword);
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(passwordHash, row.user_id);

  // Mark token as used
  db.prepare("UPDATE password_reset_tokens SET used_at = datetime('now') WHERE id = ?").run(row.id);

  // Invalidate all sessions to force re-login
  invalidateUserSessions(row.user_id);
}
