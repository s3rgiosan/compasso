import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ErrorCode } from '@compasso/shared';

vi.mock('../db/database.js', () => ({
  getDatabase: vi.fn(),
}));

vi.mock('./authService.js', () => ({
  hashPassword: vi.fn().mockReturnValue('salt:hashed'),
  invalidateUserSessions: vi.fn(),
}));

vi.mock('./emailService.js', () => ({
  sendPasswordResetEmail: vi.fn().mockResolvedValue(true),
}));

import { getDatabase } from '../db/database.js';
import { hashPassword, invalidateUserSessions } from './authService.js';
import { sendPasswordResetEmail } from './emailService.js';
import { requestPasswordReset, resetPassword } from './passwordResetService.js';

const mockRun = vi.fn();
const mockGet = vi.fn();
const mockPrepare = vi.fn().mockReturnValue({ run: mockRun, get: mockGet });

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getDatabase).mockReturnValue({ prepare: mockPrepare } as any);
  mockRun.mockReturnValue({});
  mockGet.mockReturnValue(undefined);
});

describe('requestPasswordReset', () => {
  it('does nothing when user is not found', async () => {
    mockGet.mockReturnValue(undefined);

    await requestPasswordReset('unknown@example.com', 'https://app.com');

    // Only the user lookup should have been prepared
    expect(mockPrepare).toHaveBeenCalledTimes(1);
    expect(sendPasswordResetEmail).not.toHaveBeenCalled();
  });

  it('deletes old tokens, creates new token, and sends email when user exists', async () => {
    mockGet.mockReturnValueOnce({ id: 42, email: 'user@example.com' });

    await requestPasswordReset('user@example.com', 'https://app.com');

    // 1: SELECT user, 2: DELETE old tokens, 3: INSERT new token
    expect(mockPrepare).toHaveBeenCalledTimes(3);
    expect(mockRun).toHaveBeenCalledWith(42); // delete old tokens for user_id
    expect(sendPasswordResetEmail).toHaveBeenCalledWith(
      'user@example.com',
      expect.stringContaining('https://app.com/reset-password?token=')
    );
  });
});

describe('resetPassword', () => {
  it('throws INVALID_RESET_TOKEN when token is invalid', () => {
    mockGet.mockReturnValue(undefined);

    expect(() => resetPassword('bad-token', 'newpass123')).toThrow('Invalid or expired reset token');

    try {
      resetPassword('bad-token', 'newpass123');
    } catch (err: any) {
      expect(err.code).toBe(ErrorCode.INVALID_RESET_TOKEN);
    }
  });

  it('updates password, marks token used, and invalidates sessions on valid token', () => {
    mockGet.mockReturnValueOnce({ id: 10, user_id: 42 });

    resetPassword('valid-token', 'newpass123');

    expect(hashPassword).toHaveBeenCalledWith('newpass123');
    // UPDATE users SET password_hash
    expect(mockRun).toHaveBeenCalledWith('salt:hashed', 42);
    // UPDATE password_reset_tokens SET used_at
    expect(mockRun).toHaveBeenCalledWith(10);
    expect(invalidateUserSessions).toHaveBeenCalledWith(42);
  });
});
