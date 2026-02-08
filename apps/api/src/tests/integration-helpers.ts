import supertest from 'supertest';
import type { Express } from 'express';
import { initTestDatabase, closeDatabase, getDatabase } from '../db/database.js';
import { createApp } from '../app.js';
import { registerUser } from '../services/authService.js';
import { seedCategoriesForWorkspace } from '../db/seed.js';
import type { SupportedLocale } from '@compasso/shared';

let app: Express;

export function setupTestApp(): supertest.Agent {
  initTestDatabase();
  app = createApp();
  return supertest.agent(app);
}

export function getApp(): Express {
  return app;
}

export function cleanupTestApp(): void {
  closeDatabase();
}

export interface TestUser {
  id: number;
  username: string;
  email: string;
  sessionId: string;
  workspaceId: number;
}

export function createTestUser(
  username: string = 'testuser',
  password: string = 'password123',
  email: string = `${username}@test.com`
): TestUser {
  const result = registerUser({ username, password, email });

  const db = getDatabase();
  // Find the default workspace created during registration
  const workspace = db
    .prepare(
      `SELECT w.id FROM workspaces w
       JOIN workspace_members wm ON wm.workspace_id = w.id
       WHERE wm.user_id = ? AND w.is_default = 1`
    )
    .get(result.user.id) as { id: number };

  return {
    id: result.user.id,
    username,
    email,
    sessionId: result.sessionId,
    workspaceId: workspace.id,
  };
}

export function authenticatedAgent(sessionId: string): supertest.Agent {
  const agent = supertest.agent(app);
  // Set authorization header for all requests via this agent
  agent.set('Authorization', `Bearer ${sessionId}`);
  return agent;
}

export function createTestWorkspace(userId: number, name: string): number {
  const db = getDatabase();
  const result = db
    .prepare('INSERT INTO workspaces (name, description, color, icon, is_default) VALUES (?, ?, ?, ?, 0)')
    .run(name, null, '#6366f1', 'briefcase');

  const workspaceId = Number(result.lastInsertRowid);

  db.prepare(
    'INSERT INTO workspace_members (workspace_id, user_id, role) VALUES (?, ?, ?)'
  ).run(workspaceId, userId, 'owner');

  return workspaceId;
}

export function seedTestCategories(workspaceId: number, locale?: SupportedLocale): void {
  seedCategoriesForWorkspace(workspaceId, locale);
}

export function addWorkspaceMember(
  workspaceId: number,
  userId: number,
  role: 'owner' | 'editor' | 'viewer'
): void {
  const db = getDatabase();
  db.prepare(
    'INSERT INTO workspace_members (workspace_id, user_id, role) VALUES (?, ?, ?)'
  ).run(workspaceId, userId, role);
}

export function createTestLedger(
  workspaceId: number,
  options: {
    filename?: string;
    bankId?: string;
    fileHash?: string;
    periodStart?: string;
    periodEnd?: string;
  } = {}
): number {
  const db = getDatabase();
  const result = db
    .prepare(
      'INSERT INTO ledgers (filename, bank_id, file_hash, workspace_id, period_start, period_end) VALUES (?, ?, ?, ?, ?, ?)'
    )
    .run(
      options.filename || 'test.pdf',
      options.bankId || 'novo_banco',
      options.fileHash || null,
      workspaceId,
      options.periodStart || null,
      options.periodEnd || null
    );
  return Number(result.lastInsertRowid);
}

export function createTestTransaction(
  ledgerId: number,
  options: {
    date?: string;
    description?: string;
    amount?: number;
    balance?: number | null;
    categoryId?: number | null;
    isIncome?: boolean;
    isManual?: boolean;
  } = {}
): number {
  const db = getDatabase();
  const result = db
    .prepare(
      `INSERT INTO transactions (ledger_id, date, description, amount, balance, category_id, is_income, is_manual)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      ledgerId,
      options.date || '2024-01-15',
      options.description || 'Test transaction',
      options.amount || 100,
      options.balance ?? null,
      options.categoryId ?? null,
      options.isIncome ? 1 : 0,
      options.isManual ? 1 : 0
    );
  return Number(result.lastInsertRowid);
}
