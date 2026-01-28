import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { createTestApp, TEST_USER } from './test-helpers.js';
import { AppError } from '../errors.js';

vi.mock('../middleware/auth.js', () => ({
  authMiddleware: vi.fn((_req: any, _res: any, next: any) => {
    _req.user = TEST_USER;
    _req.sessionId = 'test-session-id';
    next();
  }),
}));

vi.mock('../services/memberService.js', () => ({
  listMembers: vi.fn(),
  inviteUser: vi.fn(),
  listWorkspaceInvitations: vi.fn(),
  changeMemberRole: vi.fn(),
  removeMember: vi.fn(),
  getMyInvitations: vi.fn(),
  acceptInvitation: vi.fn(),
  declineInvitation: vi.fn(),
}));

import router from './invitations.js';
import {
  listMembers,
  inviteUser,
  listWorkspaceInvitations,
  changeMemberRole,
  removeMember,
  getMyInvitations,
  acceptInvitation,
  declineInvitation,
} from '../services/memberService.js';

// Mount at both paths like the real app does
const wsApp = createTestApp(router, '/api/workspaces');
const invApp = createTestApp(router, '/api/invitations');

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Workspace-scoped routes (mounted at /api/workspaces)', () => {
  describe('GET /api/workspaces/:wid/members', () => {
    it('returns 200 with members', async () => {
      const members = [{ userId: 1, role: 'owner' }];
      vi.mocked(listMembers).mockReturnValue(members as any);

      const res = await request(wsApp).get('/api/workspaces/1/members');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ success: true, data: members });
    });

    it('passes workspaceId and userId to service', async () => {
      vi.mocked(listMembers).mockReturnValue([]);

      await request(wsApp).get('/api/workspaces/5/members');

      expect(listMembers).toHaveBeenCalledWith(5, TEST_USER.id);
    });
  });

  describe('POST /api/workspaces/:wid/invitations', () => {
    it('returns 201 with invitation id', async () => {
      vi.mocked(inviteUser).mockReturnValue(42 as any);

      const res = await request(wsApp)
        .post('/api/workspaces/1/invitations')
        .send({ usernameOrEmail: 'user2', role: 'editor' });

      expect(res.status).toBe(201);
      expect(res.body).toEqual({ success: true, data: { id: 42 } });
    });

    it('passes workspaceId, userId, usernameOrEmail, and role to service', async () => {
      vi.mocked(inviteUser).mockReturnValue(1 as any);

      await request(wsApp)
        .post('/api/workspaces/3/invitations')
        .send({ usernameOrEmail: 'other@test.com', role: 'viewer' });

      expect(inviteUser).toHaveBeenCalledWith(3, TEST_USER.id, 'other@test.com', 'viewer');
    });
  });

  describe('GET /api/workspaces/:wid/invitations', () => {
    it('returns 200 with workspace invitations', async () => {
      const invitations = [{ id: 1, status: 'pending' }];
      vi.mocked(listWorkspaceInvitations).mockReturnValue(invitations as any);

      const res = await request(wsApp).get('/api/workspaces/1/invitations');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ success: true, data: invitations });
    });

    it('passes workspaceId and userId to service', async () => {
      vi.mocked(listWorkspaceInvitations).mockReturnValue([]);

      await request(wsApp).get('/api/workspaces/5/invitations');

      expect(listWorkspaceInvitations).toHaveBeenCalledWith(5, TEST_USER.id);
    });
  });

  describe('PUT /api/workspaces/:wid/members/:uid', () => {
    it('returns 200 on success', async () => {
      vi.mocked(changeMemberRole).mockReturnValue(undefined as any);

      const res = await request(wsApp)
        .put('/api/workspaces/1/members/2')
        .send({ role: 'editor' });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ success: true });
    });

    it('passes all params to service', async () => {
      vi.mocked(changeMemberRole).mockReturnValue(undefined as any);

      await request(wsApp)
        .put('/api/workspaces/3/members/7')
        .send({ role: 'viewer' });

      expect(changeMemberRole).toHaveBeenCalledWith(3, TEST_USER.id, 7, 'viewer');
    });
  });

  describe('DELETE /api/workspaces/:wid/members/:uid', () => {
    it('returns 200 on success', async () => {
      vi.mocked(removeMember).mockReturnValue(undefined as any);

      const res = await request(wsApp).delete('/api/workspaces/1/members/2');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ success: true });
    });

    it('passes workspaceId, userId, and targetUserId to service', async () => {
      vi.mocked(removeMember).mockReturnValue(undefined as any);

      await request(wsApp).delete('/api/workspaces/3/members/7');

      expect(removeMember).toHaveBeenCalledWith(3, TEST_USER.id, 7);
    });

    it('propagates forbidden error', async () => {
      vi.mocked(removeMember).mockImplementation(() => {
        throw AppError.forbidden('Cannot remove owner');
      });

      const res = await request(wsApp).delete('/api/workspaces/1/members/2');

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });
  });
});

describe('User-scoped routes (mounted at /api/invitations)', () => {
  describe('GET /api/invitations', () => {
    it('returns 200 with my invitations', async () => {
      const invitations = [{ id: 1, workspaceName: 'Team' }];
      vi.mocked(getMyInvitations).mockReturnValue(invitations as any);

      const res = await request(invApp).get('/api/invitations');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ success: true, data: invitations });
    });

    it('passes userId to service', async () => {
      vi.mocked(getMyInvitations).mockReturnValue([]);

      await request(invApp).get('/api/invitations');

      expect(getMyInvitations).toHaveBeenCalledWith(TEST_USER.id);
    });
  });

  describe('POST /api/invitations/:id/accept', () => {
    it('returns 200 on success', async () => {
      vi.mocked(acceptInvitation).mockReturnValue(undefined as any);

      const res = await request(invApp).post('/api/invitations/5/accept');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ success: true });
    });

    it('passes invitationId and userId to service', async () => {
      vi.mocked(acceptInvitation).mockReturnValue(undefined as any);

      await request(invApp).post('/api/invitations/10/accept');

      expect(acceptInvitation).toHaveBeenCalledWith(10, TEST_USER.id);
    });
  });

  describe('POST /api/invitations/:id/decline', () => {
    it('returns 200 on success', async () => {
      vi.mocked(declineInvitation).mockReturnValue(undefined as any);

      const res = await request(invApp).post('/api/invitations/5/decline');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ success: true });
    });

    it('passes invitationId and userId to service', async () => {
      vi.mocked(declineInvitation).mockReturnValue(undefined as any);

      await request(invApp).post('/api/invitations/10/decline');

      expect(declineInvitation).toHaveBeenCalledWith(10, TEST_USER.id);
    });
  });
});
