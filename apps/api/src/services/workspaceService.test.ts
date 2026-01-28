import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../db/database.js', () => ({ getDatabase: vi.fn() }));

import { getDatabase } from '../db/database.js';
import { getMemberRole, requireWorkspaceRole, requireWorkspaceMembership } from './workspaceService.js';
import { AppError } from '../errors.js';

const mockDb = { prepare: vi.fn() };

beforeEach(() => {
  vi.mocked(getDatabase).mockReturnValue(mockDb as any);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('workspaceService', () => {
  describe('getMemberRole', () => {
    it('should return the role when the user is a member of the workspace', () => {
      const mockGet = vi.fn().mockReturnValue({ role: 'admin' });
      mockDb.prepare.mockImplementation((sql: string) => {
        if (sql.includes('workspace_members')) {
          return { get: mockGet };
        }
      });

      const result = getMemberRole(1, 10);

      expect(result).toBe('admin');
      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining('workspace_members')
      );
      expect(mockGet).toHaveBeenCalledWith(1, 10);
    });

    it('should return null when the user is not a member of the workspace', () => {
      const mockGet = vi.fn().mockReturnValue(undefined);
      mockDb.prepare.mockImplementation((sql: string) => {
        if (sql.includes('workspace_members')) {
          return { get: mockGet };
        }
      });

      const result = getMemberRole(1, 10);

      expect(result).toBeNull();
      expect(mockGet).toHaveBeenCalledWith(1, 10);
    });

    it('should query with the correct workspace and user IDs', () => {
      const mockGet = vi.fn().mockReturnValue({ role: 'member' });
      mockDb.prepare.mockImplementation((sql: string) => {
        if (sql.includes('workspace_members')) {
          return { get: mockGet };
        }
      });

      getMemberRole(42, 99);

      expect(mockGet).toHaveBeenCalledWith(42, 99);
    });
  });

  describe('requireWorkspaceRole', () => {
    it('should return the role when the user has an allowed role', () => {
      const mockGet = vi.fn().mockReturnValue({ role: 'admin' });
      mockDb.prepare.mockImplementation((sql: string) => {
        if (sql.includes('workspace_members')) {
          return { get: mockGet };
        }
      });

      const result = requireWorkspaceRole(1, 10, ['admin', 'owner']);

      expect(result).toBe('admin');
    });

    it('should return the role when the user has one of multiple allowed roles', () => {
      const mockGet = vi.fn().mockReturnValue({ role: 'editor' });
      mockDb.prepare.mockImplementation((sql: string) => {
        if (sql.includes('workspace_members')) {
          return { get: mockGet };
        }
      });

      const result = requireWorkspaceRole(1, 10, ['admin', 'editor', 'viewer']);

      expect(result).toBe('editor');
    });

    it('should throw AppError forbidden when the user has a role not in allowedRoles', () => {
      const mockGet = vi.fn().mockReturnValue({ role: 'viewer' });
      mockDb.prepare.mockImplementation((sql: string) => {
        if (sql.includes('workspace_members')) {
          return { get: mockGet };
        }
      });

      expect(() => requireWorkspaceRole(1, 10, ['admin', 'owner'])).toThrow(AppError);

      try {
        requireWorkspaceRole(1, 10, ['admin', 'owner']);
      } catch (error) {
        expect(error).toBeInstanceOf(AppError);
        expect((error as AppError).statusCode).toBe(403);
        expect((error as AppError).message).toBe('You do not have permission to perform this action');
      }
    });

    it('should throw AppError forbidden when the user is not a member at all', () => {
      const mockGet = vi.fn().mockReturnValue(undefined);
      mockDb.prepare.mockImplementation((sql: string) => {
        if (sql.includes('workspace_members')) {
          return { get: mockGet };
        }
      });

      expect(() => requireWorkspaceRole(1, 10, ['admin'])).toThrow(AppError);

      try {
        requireWorkspaceRole(1, 10, ['admin']);
      } catch (error) {
        expect(error).toBeInstanceOf(AppError);
        expect((error as AppError).statusCode).toBe(403);
        expect((error as AppError).message).toBe('You do not have permission to perform this action');
      }
    });

    it('should throw with INSUFFICIENT_PERMISSIONS error code when role is not allowed', () => {
      const mockGet = vi.fn().mockReturnValue({ role: 'viewer' });
      mockDb.prepare.mockImplementation((sql: string) => {
        if (sql.includes('workspace_members')) {
          return { get: mockGet };
        }
      });

      try {
        requireWorkspaceRole(1, 10, ['admin']);
      } catch (error) {
        expect(error).toBeInstanceOf(AppError);
        expect((error as any).code).toBe('INSUFFICIENT_PERMISSIONS');
      }
    });
  });

  describe('requireWorkspaceMembership', () => {
    it('should return the role when the user is a member', () => {
      const mockGet = vi.fn().mockReturnValue({ role: 'member' });
      mockDb.prepare.mockImplementation((sql: string) => {
        if (sql.includes('workspace_members')) {
          return { get: mockGet };
        }
      });

      const result = requireWorkspaceMembership(1, 10);

      expect(result).toBe('member');
    });

    it('should return the role regardless of what role the member has', () => {
      const mockGet = vi.fn().mockReturnValue({ role: 'admin' });
      mockDb.prepare.mockImplementation((sql: string) => {
        if (sql.includes('workspace_members')) {
          return { get: mockGet };
        }
      });

      const result = requireWorkspaceMembership(1, 10);

      expect(result).toBe('admin');
    });

    it('should throw AppError forbidden when the user is not a member', () => {
      const mockGet = vi.fn().mockReturnValue(undefined);
      mockDb.prepare.mockImplementation((sql: string) => {
        if (sql.includes('workspace_members')) {
          return { get: mockGet };
        }
      });

      expect(() => requireWorkspaceMembership(1, 10)).toThrow(AppError);

      try {
        requireWorkspaceMembership(1, 10);
      } catch (error) {
        expect(error).toBeInstanceOf(AppError);
        expect((error as AppError).statusCode).toBe(403);
        expect((error as AppError).message).toBe('You are not a member of this workspace');
      }
    });

    it('should throw with INSUFFICIENT_PERMISSIONS error code when not a member', () => {
      const mockGet = vi.fn().mockReturnValue(undefined);
      mockDb.prepare.mockImplementation((sql: string) => {
        if (sql.includes('workspace_members')) {
          return { get: mockGet };
        }
      });

      try {
        requireWorkspaceMembership(1, 10);
      } catch (error) {
        expect(error).toBeInstanceOf(AppError);
        expect((error as any).code).toBe('INSUFFICIENT_PERMISSIONS');
      }
    });
  });
});
