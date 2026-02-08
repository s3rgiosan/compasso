import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { setupTestApp, cleanupTestApp, createTestUser } from './integration-helpers.js';
import { getDatabase } from '../db/database.js';
import type supertest from 'supertest';

let agent: supertest.Agent;

beforeEach(() => {
  agent = setupTestApp();
});

afterEach(() => {
  cleanupTestApp();
});

describe('Auth Integration', () => {
  describe('POST /api/auth/register', () => {
    it('creates user, session, and default workspace', async () => {
      const res = await agent
        .post('/api/auth/register')
        .send({ username: 'newuser', password: 'password123', email: 'new@test.com' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.username).toBe('newuser');
      expect(res.body.data.user.email).toBe('new@test.com');
      expect(res.body.data.sessionId).toBeDefined();

      // Verify user in DB
      const db = getDatabase();
      const user = db.prepare('SELECT * FROM users WHERE username = ?').get('newuser') as any;
      expect(user).toBeDefined();
      expect(user.email).toBe('new@test.com');

      // Verify session created
      const session = db.prepare('SELECT * FROM sessions WHERE user_id = ?').get(user.id) as any;
      expect(session).toBeDefined();

      // Verify default workspace created
      const workspace = db
        .prepare(
          `SELECT w.* FROM workspaces w
           JOIN workspace_members wm ON wm.workspace_id = w.id
           WHERE wm.user_id = ? AND w.is_default = 1`
        )
        .get(user.id) as any;
      expect(workspace).toBeDefined();

      // Verify user is owner of workspace
      const member = db
        .prepare('SELECT * FROM workspace_members WHERE workspace_id = ? AND user_id = ?')
        .get(workspace.id, user.id) as any;
      expect(member.role).toBe('owner');

      // Verify default categories were seeded
      const categories = db
        .prepare('SELECT COUNT(*) as count FROM categories WHERE workspace_id = ?')
        .get(workspace.id) as any;
      expect(categories.count).toBeGreaterThan(0);
    });

    it('rejects duplicate username', async () => {
      await agent
        .post('/api/auth/register')
        .send({ username: 'dupeuser', password: 'password123', email: 'first@test.com' });

      const res = await agent
        .post('/api/auth/register')
        .send({ username: 'dupeuser', password: 'password123', email: 'second@test.com' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/username/i);
    });

    it('rejects duplicate email', async () => {
      await agent
        .post('/api/auth/register')
        .send({ username: 'user1', password: 'password123', email: 'same@test.com' });

      const res = await agent
        .post('/api/auth/register')
        .send({ username: 'user2', password: 'password123', email: 'same@test.com' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/email/i);
    });
  });

  describe('POST /api/auth/login', () => {
    it('returns session with valid credentials', async () => {
      createTestUser('loginuser', 'password123', 'login@test.com');

      const res = await agent
        .post('/api/auth/login')
        .send({ username: 'loginuser', password: 'password123' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.username).toBe('loginuser');
      expect(res.body.data.sessionId).toBeDefined();
    });

    it('rejects wrong password', async () => {
      createTestUser('loginuser', 'password123', 'login@test.com');

      const res = await agent
        .post('/api/auth/login')
        .send({ username: 'loginuser', password: 'wrongpassword' });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('rejects nonexistent username', async () => {
      const res = await agent
        .post('/api/auth/login')
        .send({ username: 'nouser', password: 'password123' });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  describe('GET /api/auth/me', () => {
    it('returns user data with valid session', async () => {
      const user = createTestUser('meuser', 'password123', 'me@test.com');

      const res = await agent
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${user.sessionId}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.username).toBe('meuser');
      expect(res.body.data.email).toBe('me@test.com');
    });

    it('rejects unauthenticated request', async () => {
      const res = await agent.get('/api/auth/me');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  describe('PUT /api/auth/profile', () => {
    it('updates display name and email', async () => {
      const user = createTestUser('profuser', 'password123', 'prof@test.com');

      const res = await agent
        .put('/api/auth/profile')
        .set('Authorization', `Bearer ${user.sessionId}`)
        .send({ displayName: 'New Name', email: 'newemail@test.com' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.displayName).toBe('New Name');
      expect(res.body.data.email).toBe('newemail@test.com');

      // Verify persisted
      const db = getDatabase();
      const dbUser = db.prepare('SELECT display_name, email FROM users WHERE id = ?').get(user.id) as any;
      expect(dbUser.display_name).toBe('New Name');
      expect(dbUser.email).toBe('newemail@test.com');
    });
  });

  describe('PUT /api/auth/password', () => {
    it('changes password successfully', async () => {
      const user = createTestUser('pwuser', 'oldpassword1', 'pw@test.com');

      const res = await agent
        .put('/api/auth/password')
        .set('Authorization', `Bearer ${user.sessionId}`)
        .send({ currentPassword: 'oldpassword1', newPassword: 'newpassword1' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Old password should no longer work
      const loginOld = await agent
        .post('/api/auth/login')
        .send({ username: 'pwuser', password: 'oldpassword1' });
      expect(loginOld.status).toBe(401);

      // New password should work
      const loginNew = await agent
        .post('/api/auth/login')
        .send({ username: 'pwuser', password: 'newpassword1' });
      expect(loginNew.status).toBe(200);
    });

    it('rejects wrong current password', async () => {
      const user = createTestUser('pwuser2', 'password123', 'pw2@test.com');

      const res = await agent
        .put('/api/auth/password')
        .set('Authorization', `Bearer ${user.sessionId}`)
        .send({ currentPassword: 'wrongpassword', newPassword: 'newpassword1' });

      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/auth/logout', () => {
    it('deletes session and subsequent requests fail', async () => {
      const user = createTestUser('logoutuser', 'password123', 'logout@test.com');

      // Verify session works
      const meRes = await agent
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${user.sessionId}`);
      expect(meRes.status).toBe(200);

      // Logout
      const logoutRes = await agent
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${user.sessionId}`);
      expect(logoutRes.status).toBe(200);

      // Session should no longer work
      const meRes2 = await agent
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${user.sessionId}`);
      expect(meRes2.status).toBe(401);
    });
  });

  describe('Expired session', () => {
    it('rejects expired session', async () => {
      const user = createTestUser('expuser', 'password123', 'exp@test.com');

      // Manually expire the session
      const db = getDatabase();
      db.prepare("UPDATE sessions SET expires_at = datetime('now', '-1 day') WHERE id = ?")
        .run(user.sessionId);

      const res = await agent
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${user.sessionId}`);

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });
});
