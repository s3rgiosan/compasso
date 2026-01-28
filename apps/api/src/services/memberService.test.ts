import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../db/database.js', () => ({ getDatabase: vi.fn() }));
vi.mock('./workspaceService.js', () => ({
  getMemberRole: vi.fn(),
  requireWorkspaceRole: vi.fn().mockReturnValue('owner'),
  requireWorkspaceMembership: vi.fn().mockReturnValue('owner'),
}));

import { getDatabase } from '../db/database.js';
import {
  getMemberRole,
  requireWorkspaceRole,
  requireWorkspaceMembership,
} from './workspaceService.js';
import { AppError } from '../errors.js';
import {
  listMembers,
  inviteUser,
  listWorkspaceInvitations,
  changeMemberRole,
  removeMember,
  getMyInvitations,
  acceptInvitation,
  declineInvitation,
} from './memberService.js';

let mockDb: Record<string, any>;

beforeEach(() => {
  vi.clearAllMocks();

  // Reset mock implementations to defaults after clearAllMocks
  vi.mocked(requireWorkspaceRole).mockReturnValue('owner' as any);
  vi.mocked(requireWorkspaceMembership).mockReturnValue('owner' as any);

  mockDb = {
    prepare: vi.fn().mockReturnValue({
      all: vi.fn().mockReturnValue([]),
      get: vi.fn().mockReturnValue(undefined),
      run: vi.fn().mockReturnValue({ lastInsertRowid: 1 }),
    }),
  };
  (mockDb as any).transaction = vi.fn().mockImplementation((fn) => fn);
  vi.mocked(getDatabase).mockReturnValue(mockDb as any);
});

describe('memberService', () => {
  // ---------------------------------------------------------------------------
  // listMembers
  // ---------------------------------------------------------------------------
  describe('listMembers', () => {
    it('should return members for the workspace', () => {
      const rows = [
        { id: 1, user_id: 10, username: 'alice', email: 'alice@example.com', role: 'owner', joined_at: '2024-01-01' },
        { id: 2, user_id: 11, username: 'bob', email: 'bob@example.com', role: 'editor', joined_at: '2024-01-02' },
      ];
      mockDb.prepare.mockReturnValue({ all: vi.fn().mockReturnValue(rows), get: vi.fn(), run: vi.fn() });

      const result = listMembers(1, 10);

      expect(requireWorkspaceMembership).toHaveBeenCalledWith(1, 10);
      expect(result.length).toBe(2);
    });

    it('should require workspace membership', () => {
      vi.mocked(requireWorkspaceMembership).mockImplementation(() => {
        throw AppError.forbidden('Not a member');
      });

      expect(() => listMembers(1, 99)).toThrow(AppError);
      expect(requireWorkspaceMembership).toHaveBeenCalledWith(1, 99);
    });
  });

  // ---------------------------------------------------------------------------
  // inviteUser
  // ---------------------------------------------------------------------------
  describe('inviteUser', () => {
    it('should create an invitation and return the id', () => {
      const targetUser = { id: 20, username: 'charlie', email: 'charlie@example.com' };
      const stmtGet = vi.fn()
        .mockReturnValueOnce(targetUser) // user lookup
        .mockReturnValueOnce(undefined); // pending invitation check
      const stmtRun = vi.fn().mockReturnValue({ lastInsertRowid: 5 });
      mockDb.prepare.mockReturnValue({ get: stmtGet, all: vi.fn(), run: stmtRun });
      vi.mocked(getMemberRole).mockReturnValue(null as any);

      const result = inviteUser(1, 10, 'charlie', 'editor');

      expect(requireWorkspaceRole).toHaveBeenCalledWith(1, 10, ['owner', 'editor']);
      expect(result).toBe(5);
    });

    it('should reject if usernameOrEmail or role is missing', () => {
      expect(() => inviteUser(1, 10, '', 'editor')).toThrow('usernameOrEmail and role are required');
      expect(() => inviteUser(1, 10, 'charlie', '')).toThrow('usernameOrEmail and role are required');
    });

    it('should reject an invalid role', () => {
      expect(() => inviteUser(1, 10, 'charlie', 'owner')).toThrow('Role must be editor or viewer');
      expect(() => inviteUser(1, 10, 'charlie', 'admin')).toThrow('Role must be editor or viewer');
    });

    it('should reject if the user is not found', () => {
      mockDb.prepare.mockReturnValue({ get: vi.fn().mockReturnValue(undefined), all: vi.fn(), run: vi.fn() });

      expect(() => inviteUser(1, 10, 'ghost', 'editor')).toThrow('User not found');
    });

    it('should reject if inviting yourself', () => {
      const self = { id: 10, username: 'alice', email: 'alice@example.com' };
      mockDb.prepare.mockReturnValue({ get: vi.fn().mockReturnValue(self), all: vi.fn(), run: vi.fn() });

      expect(() => inviteUser(1, 10, 'alice', 'editor')).toThrow('You cannot invite yourself');
    });

    it('should reject if user is already a member', () => {
      const targetUser = { id: 20, username: 'charlie', email: 'charlie@example.com' };
      mockDb.prepare.mockReturnValue({ get: vi.fn().mockReturnValue(targetUser), all: vi.fn(), run: vi.fn() });
      vi.mocked(getMemberRole).mockReturnValue('editor' as any);

      expect(() => inviteUser(1, 10, 'charlie', 'editor')).toThrow('User is already a member of this workspace');
    });

    it('should reject if user already has a pending invitation', () => {
      const targetUser = { id: 20, username: 'charlie', email: 'charlie@example.com' };
      const pendingInvite = { id: 3, status: 'pending' };
      const stmtGet = vi.fn()
        .mockReturnValueOnce(targetUser)
        .mockReturnValueOnce(pendingInvite);
      mockDb.prepare.mockReturnValue({ get: stmtGet, all: vi.fn(), run: vi.fn() });
      vi.mocked(getMemberRole).mockReturnValue(null as any);

      expect(() => inviteUser(1, 10, 'charlie', 'editor')).toThrow('User already has a pending invitation');
    });

    it('should require owner or editor role', () => {
      vi.mocked(requireWorkspaceRole).mockImplementation(() => {
        throw AppError.forbidden('Insufficient permissions');
      });

      expect(() => inviteUser(1, 10, 'charlie', 'editor')).toThrow(AppError);
      expect(requireWorkspaceRole).toHaveBeenCalledWith(1, 10, ['owner', 'editor']);
    });
  });

  // ---------------------------------------------------------------------------
  // listWorkspaceInvitations
  // ---------------------------------------------------------------------------
  describe('listWorkspaceInvitations', () => {
    it('should return invitations for the workspace', () => {
      const rows = [
        { id: 1, workspace_id: 1, invited_user_id: 20, invited_by: 10, role: 'editor', status: 'pending', created_at: '2024-01-01', username: 'charlie', email: 'charlie@example.com' },
      ];
      mockDb.prepare.mockReturnValue({ all: vi.fn().mockReturnValue(rows), get: vi.fn(), run: vi.fn() });

      const result = listWorkspaceInvitations(1, 10);

      expect(requireWorkspaceRole).toHaveBeenCalledWith(1, 10, ['owner', 'editor']);
      expect(result.length).toBe(1);
    });

    it('should require owner or editor role', () => {
      vi.mocked(requireWorkspaceRole).mockImplementation(() => {
        throw AppError.forbidden('Insufficient permissions');
      });

      expect(() => listWorkspaceInvitations(1, 99)).toThrow(AppError);
      expect(requireWorkspaceRole).toHaveBeenCalledWith(1, 99, ['owner', 'editor']);
    });
  });

  // ---------------------------------------------------------------------------
  // changeMemberRole
  // ---------------------------------------------------------------------------
  describe('changeMemberRole', () => {
    it('should change the role of a member', () => {
      vi.mocked(getMemberRole).mockReturnValue('editor' as any);
      mockDb.prepare.mockReturnValue({ run: vi.fn(), get: vi.fn(), all: vi.fn() });

      changeMemberRole(1, 10, 20, 'viewer');

      expect(requireWorkspaceRole).toHaveBeenCalledWith(1, 10, ['owner']);
      expect(getMemberRole).toHaveBeenCalledWith(1, 20);
    });

    it('should reject an invalid role', () => {
      expect(() => changeMemberRole(1, 10, 20, 'admin')).toThrow('Role must be editor or viewer');
    });

    it('should block changing the owner role', () => {
      vi.mocked(getMemberRole).mockReturnValue('owner' as any);

      expect(() => changeMemberRole(1, 10, 20, 'editor')).toThrow('Cannot change the role of the workspace owner');
    });

    it('should throw not found if member does not exist', () => {
      vi.mocked(getMemberRole).mockReturnValue(null as any);

      expect(() => changeMemberRole(1, 10, 20, 'editor')).toThrow('Member not found');
    });

    it('should require owner role', () => {
      vi.mocked(requireWorkspaceRole).mockImplementation(() => {
        throw AppError.forbidden('Insufficient permissions');
      });

      expect(() => changeMemberRole(1, 10, 20, 'editor')).toThrow(AppError);
      expect(requireWorkspaceRole).toHaveBeenCalledWith(1, 10, ['owner']);
    });
  });

  // ---------------------------------------------------------------------------
  // removeMember
  // ---------------------------------------------------------------------------
  describe('removeMember', () => {
    it('should remove a member when requester is owner', () => {
      vi.mocked(getMemberRole)
        .mockReturnValueOnce('owner' as any)   // requester role
        .mockReturnValueOnce('editor' as any);  // target role
      mockDb.prepare.mockReturnValue({ run: vi.fn(), get: vi.fn(), all: vi.fn() });

      removeMember(1, 10, 20);

      expect(getMemberRole).toHaveBeenCalledWith(1, 10);
      expect(getMemberRole).toHaveBeenCalledWith(1, 20);
    });

    it('should allow self-removal for non-owners', () => {
      vi.mocked(getMemberRole)
        .mockReturnValueOnce('editor' as any)   // requester role (self)
        .mockReturnValueOnce('editor' as any);  // target role (same user)
      mockDb.prepare.mockReturnValue({ run: vi.fn(), get: vi.fn(), all: vi.fn() });

      removeMember(1, 10, 10);

      expect(getMemberRole).toHaveBeenCalledWith(1, 10);
    });

    it('should block owner removal', () => {
      vi.mocked(getMemberRole)
        .mockReturnValueOnce('owner' as any)   // requester role
        .mockReturnValueOnce('owner' as any);  // target role

      expect(() => removeMember(1, 10, 20)).toThrow('Cannot remove the workspace owner');
    });

    it('should throw not found if target member does not exist', () => {
      vi.mocked(getMemberRole)
        .mockReturnValueOnce('owner' as any)  // requester role
        .mockReturnValueOnce(null as any);     // target not found

      expect(() => removeMember(1, 10, 20)).toThrow('Member not found');
    });

    it('should require owner role for removing other members', () => {
      vi.mocked(getMemberRole).mockReturnValueOnce('editor' as any); // requester is editor

      expect(() => removeMember(1, 10, 20)).toThrow('Only workspace owners can remove members');
    });
  });

  // ---------------------------------------------------------------------------
  // getMyInvitations
  // ---------------------------------------------------------------------------
  describe('getMyInvitations', () => {
    it('should return pending invitations for the user', () => {
      const rows = [
        { id: 1, workspace_id: 1, invited_user_id: 10, invited_by: 5, role: 'editor', status: 'pending', created_at: '2024-01-01', workspace_name: 'My Workspace', inviter_username: 'admin' },
      ];
      mockDb.prepare.mockReturnValue({ all: vi.fn().mockReturnValue(rows), get: vi.fn(), run: vi.fn() });

      const result = getMyInvitations(10);

      expect(result.length).toBe(1);
    });
  });

  // ---------------------------------------------------------------------------
  // acceptInvitation
  // ---------------------------------------------------------------------------
  describe('acceptInvitation', () => {
    it('should accept the invitation and create workspace membership', () => {
      const invitation = { id: 1, workspace_id: 1, invited_user_id: 10, role: 'editor', status: 'pending' };
      mockDb.prepare.mockReturnValue({
        get: vi.fn().mockReturnValue(invitation),
        run: vi.fn(),
        all: vi.fn(),
      });

      acceptInvitation(1, 10);

      expect(mockDb.transaction).toHaveBeenCalled();
    });

    it('should throw not found if invitation does not exist or belongs to another user', () => {
      mockDb.prepare.mockReturnValue({ get: vi.fn().mockReturnValue(undefined), run: vi.fn(), all: vi.fn() });

      expect(() => acceptInvitation(1, 99)).toThrow('Invitation not found or already responded');
    });
  });

  // ---------------------------------------------------------------------------
  // declineInvitation
  // ---------------------------------------------------------------------------
  describe('declineInvitation', () => {
    it('should decline the invitation', () => {
      const invitation = { id: 1, workspace_id: 1, invited_user_id: 10, role: 'editor', status: 'pending' };
      mockDb.prepare.mockReturnValue({
        get: vi.fn().mockReturnValue(invitation),
        run: vi.fn(),
        all: vi.fn(),
      });

      declineInvitation(1, 10);

      expect(mockDb.prepare).toHaveBeenCalled();
    });

    it('should throw not found if invitation does not exist or belongs to another user', () => {
      mockDb.prepare.mockReturnValue({ get: vi.fn().mockReturnValue(undefined), run: vi.fn(), all: vi.fn() });

      expect(() => declineInvitation(1, 99)).toThrow('Invitation not found or already responded');
    });
  });
});
