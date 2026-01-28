import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('crypto', async () => {
  const actual = await vi.importActual<typeof import('crypto')>('crypto');
  return {
    ...actual,
    default: {
      ...actual,
      randomBytes: vi.fn().mockReturnValue({ toString: () => 'a'.repeat(32) }),
      pbkdf2Sync: vi.fn().mockReturnValue({ toString: () => 'b'.repeat(128) }),
    },
  };
});

vi.mock('../db/database.js', () => ({ getDatabase: vi.fn() }));
vi.mock('../db/seed.js', () => ({ seedCategoriesForWorkspace: vi.fn() }));

import { getDatabase } from '../db/database.js';
import { registerUser, loginUser, logoutUser, updateProfile, changePassword } from './authService.js';
import { AppError } from '../errors.js';

const hashedPassword = 'a'.repeat(32) + ':' + 'b'.repeat(128);
const wrongHashedPassword = 'a'.repeat(32) + ':' + 'c'.repeat(128);

const mockRun = vi.fn();
const mockGet = vi.fn();
const mockAll = vi.fn();
const mockDb = { prepare: vi.fn() };

beforeEach(() => {
  vi.clearAllMocks();
  mockRun.mockReturnValue({ changes: 1 });
  mockGet.mockReturnValue(undefined);
  mockAll.mockReturnValue([]);
  mockDb.prepare.mockReturnValue({ run: mockRun, get: mockGet, all: mockAll });
  vi.mocked(getDatabase).mockReturnValue(mockDb as any);
});

describe('authService', () => {
  // ---------------------------------------------------------------------------
  // registerUser
  // ---------------------------------------------------------------------------
  describe('registerUser', () => {
    it('should register a new user and return user with sessionId', () => {
      mockGet.mockReturnValue(undefined);
      mockRun.mockReturnValue({ lastInsertRowid: 1 });

      const result = registerUser({
        username: 'testuser',
        password: 'password123',
        email: 'test@example.com',
        displayName: 'Test User',
      });

      expect(result).toHaveProperty('user');
      expect(result).toHaveProperty('sessionId');
      expect(result.user).toMatchObject({
        username: 'testuser',
      });
      expect(mockDb.prepare).toHaveBeenCalled();
      expect(mockRun).toHaveBeenCalled();
    });

    it('should throw if username is missing', () => {
      expect(() =>
        registerUser({ username: '', password: 'password123', email: 'test@example.com' }),
      ).toThrow(AppError);

      expect(() =>
        registerUser({ username: '', password: 'password123', email: 'test@example.com' }),
      ).toThrow('Username and password are required');
    });

    it('should throw if password is missing', () => {
      expect(() =>
        registerUser({ username: 'testuser', password: '', email: 'test@example.com' }),
      ).toThrow(AppError);

      expect(() =>
        registerUser({ username: 'testuser', password: '', email: 'test@example.com' }),
      ).toThrow('Username and password are required');
    });

    it('should throw if username is too short', () => {
      expect(() =>
        registerUser({ username: 'ab', password: 'password123', email: 'test@example.com' }),
      ).toThrow('Username must be between 3 and 50 characters');
    });

    it('should throw if username is too long', () => {
      expect(() =>
        registerUser({ username: 'a'.repeat(51), password: 'password123', email: 'test@example.com' }),
      ).toThrow('Username must be between 3 and 50 characters');
    });

    it('should throw if username contains invalid characters', () => {
      expect(() =>
        registerUser({ username: 'test user!', password: 'password123', email: 'test@example.com' }),
      ).toThrow('Username can only contain letters, numbers, underscores, and hyphens');
    });

    it('should throw if password is shorter than 8 characters', () => {
      expect(() =>
        registerUser({ username: 'testuser', password: 'short', email: 'test@example.com' }),
      ).toThrow('Password must be at least 8 characters');
    });

    it('should throw if email format is invalid', () => {
      expect(() =>
        registerUser({ username: 'testuser', password: 'password123', email: 'not-an-email' }),
      ).toThrow('Invalid email format');
    });

    it('should throw if username is already taken', () => {
      mockGet.mockReturnValueOnce({ id: 'existing-user-id', username: 'testuser' });

      expect(() =>
        registerUser({ username: 'testuser', password: 'password123', email: 'test@example.com' }),
      ).toThrow('Username already taken');
    });

    it('should throw if email is already registered', () => {
      mockGet
        .mockReturnValueOnce(undefined)
        .mockReturnValueOnce({ id: 'existing-user-id', email: 'test@example.com' });

      expect(() =>
        registerUser({ username: 'testuser', password: 'password123', email: 'test@example.com' }),
      ).toThrow('Email already registered');
    });
  });

  // ---------------------------------------------------------------------------
  // loginUser
  // ---------------------------------------------------------------------------
  describe('loginUser', () => {
    it('should login an existing user and return user with sessionId', () => {
      mockGet.mockReturnValueOnce({
        id: 1,
        username: 'testuser',
        password_hash: hashedPassword,
        email: 'test@example.com',
        display_name: 'Test User',
        locale: 'en',
        created_at: '2024-01-01',
      });

      const result = loginUser({ username: 'testuser', password: 'password123' });

      expect(result).toHaveProperty('user');
      expect(result).toHaveProperty('sessionId');
      expect(result.user).toMatchObject({ username: 'testuser' });
    });

    it('should throw if username is missing', () => {
      expect(() =>
        loginUser({ username: '', password: 'password123' }),
      ).toThrow('Username and password are required');
    });

    it('should throw if password is missing', () => {
      expect(() =>
        loginUser({ username: 'testuser', password: '' }),
      ).toThrow('Username and password are required');
    });

    it('should throw if user is not found', () => {
      mockGet.mockReturnValueOnce(undefined);

      expect(() =>
        loginUser({ username: 'nonexistent', password: 'password123' }),
      ).toThrow('Invalid username or password');
    });

    it('should throw if password is wrong', () => {
      mockGet.mockReturnValueOnce({
        id: 1,
        username: 'testuser',
        password_hash: wrongHashedPassword,
        email: 'test@example.com',
        display_name: 'Test User',
        locale: 'en',
        created_at: '2024-01-01',
      });

      expect(() =>
        loginUser({ username: 'testuser', password: 'wrongpassword' }),
      ).toThrow('Invalid username or password');
    });
  });

  // ---------------------------------------------------------------------------
  // logoutUser
  // ---------------------------------------------------------------------------
  describe('logoutUser', () => {
    it('should delete the session', () => {
      logoutUser('session-123');

      expect(mockDb.prepare).toHaveBeenCalled();
      expect(mockRun).toHaveBeenCalledWith('session-123');
    });
  });

  // ---------------------------------------------------------------------------
  // updateProfile
  // ---------------------------------------------------------------------------
  describe('updateProfile', () => {
    it('should update displayName and return updated user', () => {
      mockGet.mockReturnValueOnce({
        id: 1,
        username: 'testuser',
        email: 'test@example.com',
        display_name: 'New Name',
        locale: 'en',
        created_at: '2024-01-01',
      });

      const result = updateProfile(1, { displayName: 'New Name' });

      expect(result).toMatchObject({ displayName: 'New Name' });
      expect(mockRun).toHaveBeenCalled();
    });

    it('should update email and return updated user', () => {
      mockGet
        .mockReturnValueOnce(undefined)
        .mockReturnValueOnce({
          id: 1,
          username: 'testuser',
          email: 'new@example.com',
          display_name: 'Test User',
          locale: 'en',
          created_at: '2024-01-01',
        });

      const result = updateProfile(1, { email: 'new@example.com' });

      expect(result).toMatchObject({ email: 'new@example.com' });
    });

    it('should throw if no fields to update', () => {
      expect(() => updateProfile(1, {})).toThrow('No fields to update');
    });

    it('should throw if email format is invalid', () => {
      expect(() =>
        updateProfile(1, { email: 'bad-email' }),
      ).toThrow('Invalid email format');
    });

    it('should throw if email is already registered', () => {
      mockGet.mockReturnValueOnce({ id: 2, email: 'taken@example.com' });

      expect(() =>
        updateProfile(1, { email: 'taken@example.com' }),
      ).toThrow('Email already registered');
    });
  });

  // ---------------------------------------------------------------------------
  // changePassword
  // ---------------------------------------------------------------------------
  describe('changePassword', () => {
    it('should change password successfully', () => {
      mockGet.mockReturnValueOnce({
        id: 1,
        username: 'testuser',
        password_hash: hashedPassword,
      });

      expect(() =>
        changePassword(1, 'oldpassword', 'newpassword123'),
      ).not.toThrow();

      expect(mockRun).toHaveBeenCalled();
    });

    it('should throw if current password is missing', () => {
      expect(() =>
        changePassword(1, '', 'newpassword123'),
      ).toThrow('Current password and new password are required');
    });

    it('should throw if new password is missing', () => {
      expect(() =>
        changePassword(1, 'oldpassword', ''),
      ).toThrow('Current password and new password are required');
    });

    it('should throw if new password is too short', () => {
      expect(() =>
        changePassword(1, 'oldpassword', 'short'),
      ).toThrow('New password must be at least 8 characters');
    });

    it('should throw if user is not found', () => {
      mockGet.mockReturnValueOnce(undefined);

      expect(() =>
        changePassword(1, 'oldpassword', 'newpassword123'),
      ).toThrow('User not found');
    });

    it('should throw if current password is incorrect', () => {
      mockGet.mockReturnValueOnce({
        id: 1,
        username: 'testuser',
        password_hash: wrongHashedPassword,
      });

      expect(() =>
        changePassword(1, 'wrongpassword', 'newpassword123'),
      ).toThrow('Current password is incorrect');
    });
  });
});
