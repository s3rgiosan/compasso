import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  setupTestApp,
  cleanupTestApp,
  createTestUser,
  type TestUser,
} from './integration-helpers.js';
import type supertest from 'supertest';

let agent: supertest.Agent;

beforeEach(() => {
  agent = setupTestApp();
});

afterEach(() => {
  cleanupTestApp();
});

describe('Workspaces & Members Integration', () => {
  describe('POST /api/workspaces', () => {
    it('creates workspace with user as owner', async () => {
      const user = createTestUser('wsowner', 'password123', 'wsowner@test.com');

      const res = await agent
        .post('/api/workspaces')
        .set('Authorization', `Bearer ${user.sessionId}`)
        .send({ name: 'New Workspace', description: 'A test workspace' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('New Workspace');
      expect(res.body.data.role).toBe('owner');
    });
  });

  describe('GET /api/workspaces', () => {
    it('only shows workspaces user is a member of', async () => {
      const userA = createTestUser('usera', 'password123', 'a@test.com');
      const userB = createTestUser('userb', 'password123', 'b@test.com');

      // User A creates extra workspace
      await agent
        .post('/api/workspaces')
        .set('Authorization', `Bearer ${userA.sessionId}`)
        .send({ name: 'A Extra Workspace' });

      // User B should only see their own default workspace
      const resB = await agent
        .get('/api/workspaces')
        .set('Authorization', `Bearer ${userB.sessionId}`);

      expect(resB.status).toBe(200);
      const workspaceNames = resB.body.data.map((w: any) => w.name);
      expect(workspaceNames).not.toContain('A Extra Workspace');
      expect(resB.body.data.length).toBe(1); // Only default workspace
    });
  });

  describe('Invitations', () => {
    let owner: TestUser;
    let invitee: TestUser;

    beforeEach(() => {
      owner = createTestUser('owner', 'password123', 'owner@test.com');
      invitee = createTestUser('invitee', 'password123', 'invitee@test.com');
    });

    it('creates pending invitation', async () => {
      const res = await agent
        .post(`/api/workspaces/${owner.workspaceId}/invitations`)
        .set('Authorization', `Bearer ${owner.sessionId}`)
        .send({ usernameOrEmail: 'invitee', role: 'editor' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBeDefined();

      // Verify invitee sees invitation
      const invRes = await agent
        .get('/api/invitations')
        .set('Authorization', `Bearer ${invitee.sessionId}`);

      expect(invRes.status).toBe(200);
      expect(invRes.body.data.length).toBe(1);
      expect(invRes.body.data[0].role).toBe('editor');
    });

    it('accept invitation makes user a member with correct role', async () => {
      // Create invitation
      const invRes = await agent
        .post(`/api/workspaces/${owner.workspaceId}/invitations`)
        .set('Authorization', `Bearer ${owner.sessionId}`)
        .send({ usernameOrEmail: 'invitee', role: 'editor' });

      const invitationId = invRes.body.data.id;

      // Accept invitation
      const acceptRes = await agent
        .post(`/api/invitations/${invitationId}/accept`)
        .set('Authorization', `Bearer ${invitee.sessionId}`);

      expect(acceptRes.status).toBe(200);

      // Invitee should now see owner's workspace
      const wsRes = await agent
        .get('/api/workspaces')
        .set('Authorization', `Bearer ${invitee.sessionId}`);

      const ownerWorkspace = wsRes.body.data.find((w: any) => w.id === owner.workspaceId);
      expect(ownerWorkspace).toBeDefined();
      expect(ownerWorkspace.role).toBe('editor');
    });

    it('decline invitation updates status', async () => {
      const invRes = await agent
        .post(`/api/workspaces/${owner.workspaceId}/invitations`)
        .set('Authorization', `Bearer ${owner.sessionId}`)
        .send({ usernameOrEmail: 'invitee', role: 'viewer' });

      const invitationId = invRes.body.data.id;

      const declineRes = await agent
        .post(`/api/invitations/${invitationId}/decline`)
        .set('Authorization', `Bearer ${invitee.sessionId}`);

      expect(declineRes.status).toBe(200);

      // Invitee should NOT be a member
      const wsRes = await agent
        .get('/api/workspaces')
        .set('Authorization', `Bearer ${invitee.sessionId}`);

      const ownerWorkspace = wsRes.body.data.find((w: any) => w.id === owner.workspaceId);
      expect(ownerWorkspace).toBeUndefined();
    });
  });

  describe('Member role management', () => {
    let owner: TestUser;
    let member: TestUser;

    beforeEach(async () => {
      owner = createTestUser('owner2', 'password123', 'owner2@test.com');
      member = createTestUser('member2', 'password123', 'member2@test.com');

      // Invite and accept
      const invRes = await agent
        .post(`/api/workspaces/${owner.workspaceId}/invitations`)
        .set('Authorization', `Bearer ${owner.sessionId}`)
        .send({ usernameOrEmail: 'member2', role: 'viewer' });

      await agent
        .post(`/api/invitations/${invRes.body.data.id}/accept`)
        .set('Authorization', `Bearer ${member.sessionId}`);
    });

    it('owner can change member role', async () => {
      const res = await agent
        .put(`/api/workspaces/${owner.workspaceId}/members/${member.id}`)
        .set('Authorization', `Bearer ${owner.sessionId}`)
        .send({ role: 'editor' });

      expect(res.status).toBe(200);

      // Verify role changed
      const wsRes = await agent
        .get('/api/workspaces')
        .set('Authorization', `Bearer ${member.sessionId}`);

      const ws = wsRes.body.data.find((w: any) => w.id === owner.workspaceId);
      expect(ws.role).toBe('editor');
    });

    it('owner can remove member', async () => {
      const res = await agent
        .delete(`/api/workspaces/${owner.workspaceId}/members/${member.id}`)
        .set('Authorization', `Bearer ${owner.sessionId}`);

      expect(res.status).toBe(200);

      // Member should no longer see workspace
      const wsRes = await agent
        .get('/api/workspaces')
        .set('Authorization', `Bearer ${member.sessionId}`);

      const ws = wsRes.body.data.find((w: any) => w.id === owner.workspaceId);
      expect(ws).toBeUndefined();
    });

    it('viewer cannot modify workspace data', async () => {
      const res = await agent
        .put(`/api/workspaces/${owner.workspaceId}`)
        .set('Authorization', `Bearer ${member.sessionId}`)
        .send({ name: 'Hacked Name' });

      expect(res.status).toBe(403);
    });

    it('editor can modify workspace but not manage members', async () => {
      // Promote to editor first
      await agent
        .put(`/api/workspaces/${owner.workspaceId}/members/${member.id}`)
        .set('Authorization', `Bearer ${owner.sessionId}`)
        .send({ role: 'editor' });

      // Editor can update workspace
      const updateRes = await agent
        .put(`/api/workspaces/${owner.workspaceId}`)
        .set('Authorization', `Bearer ${member.sessionId}`)
        .send({ name: 'Updated by Editor' });

      expect(updateRes.status).toBe(200);

      // Editor cannot change roles (only owner can)
      const roleRes = await agent
        .put(`/api/workspaces/${owner.workspaceId}/members/${owner.id}`)
        .set('Authorization', `Bearer ${member.sessionId}`)
        .send({ role: 'viewer' });

      expect(roleRes.status).toBe(403);
    });
  });

  describe('Data isolation', () => {
    it('user A cannot see user B workspaces', async () => {
      const userA = createTestUser('isolatea', 'password123', 'isolatea@test.com');
      const userB = createTestUser('isolateb', 'password123', 'isolateb@test.com');

      // Get user A's workspace
      const resA = await agent
        .get('/api/workspaces')
        .set('Authorization', `Bearer ${userA.sessionId}`);

      // User B tries to access user A's workspace by ID
      const wsIdA = resA.body.data[0].id;
      const resB = await agent
        .get(`/api/workspaces/${wsIdA}`)
        .set('Authorization', `Bearer ${userB.sessionId}`);

      expect(resB.status).toBe(404);
    });
  });
});
