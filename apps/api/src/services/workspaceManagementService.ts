import { getDatabase } from '../db/database.js';
import { seedCategoriesForWorkspace } from '../db/seed.js';
import { AppError } from '../errors.js';
import { requireWorkspaceRole } from './workspaceService.js';
import { DEFAULT_LOCALE, type Workspace, type SupportedLocale } from '@compasso/shared';

interface DbWorkspace {
  id: number;
  name: string;
  description: string | null;
  color: string;
  icon: string;
  is_default: number;
  created_at: string;
  role: string;
}

/**
 * List all workspaces the user is a member of.
 */
export function listUserWorkspaces(userId: number): Workspace[] {
  const db = getDatabase();

  const workspaces = db
    .prepare(
      `
      SELECT w.id, w.name, w.description, w.color, w.icon, w.is_default,
             w.created_at, wm.role
      FROM workspaces w
      JOIN workspace_members wm ON wm.workspace_id = w.id
      WHERE wm.user_id = ?
      ORDER BY w.is_default DESC, w.name ASC
    `
    )
    .all(userId) as DbWorkspace[];

  return workspaces.map((w) => ({
    id: w.id,
    name: w.name,
    description: w.description,
    color: w.color,
    icon: w.icon,
    isDefault: w.is_default === 1,
    createdAt: w.created_at,
    role: w.role as Workspace['role'],
  }));
}

/**
 * Get a single workspace by ID, verifying the user is a member.
 */
export function getWorkspace(workspaceId: number, userId: number): Workspace {
  const db = getDatabase();

  const workspace = db
    .prepare(
      `
      SELECT w.id, w.name, w.description, w.color, w.icon, w.is_default,
             w.created_at, wm.role
      FROM workspaces w
      JOIN workspace_members wm ON wm.workspace_id = w.id
      WHERE w.id = ? AND wm.user_id = ?
    `
    )
    .get(workspaceId, userId) as DbWorkspace | undefined;

  if (!workspace) {
    throw AppError.notFound('Workspace not found');
  }

  return {
    id: workspace.id,
    name: workspace.name,
    description: workspace.description,
    color: workspace.color,
    icon: workspace.icon,
    isDefault: workspace.is_default === 1,
    createdAt: workspace.created_at,
    role: workspace.role as Workspace['role'],
  };
}

/**
 * Create a new workspace, add the creator as owner, and seed default categories.
 */
export function createWorkspace(
  userId: number,
  data: { name: string; description?: string; color?: string; icon?: string }
): Workspace {
  if (!data.name) {
    throw AppError.badRequest('Workspace name is required');
  }

  const db = getDatabase();

  const result = db
    .prepare(
      'INSERT INTO workspaces (name, description, color, icon, is_default) VALUES (?, ?, ?, ?, 0)'
    )
    .run(
      data.name,
      data.description || null,
      data.color || '#6366f1',
      data.icon || 'briefcase'
    );

  const workspaceId = result.lastInsertRowid as number;

  db.prepare(
    'INSERT INTO workspace_members (workspace_id, user_id, role) VALUES (?, ?, ?)'
  ).run(workspaceId, userId, 'owner');

  // Look up user locale for category localization
  const userRow = db
    .prepare('SELECT locale FROM users WHERE id = ?')
    .get(userId) as { locale: string | null } | undefined;
  const locale = (userRow?.locale as SupportedLocale) || DEFAULT_LOCALE;

  seedCategoriesForWorkspace(workspaceId, locale);

  return {
    id: workspaceId,
    name: data.name,
    description: data.description || null,
    color: data.color || '#6366f1',
    icon: data.icon || 'briefcase',
    isDefault: false,
    createdAt: new Date().toISOString(),
    role: 'owner',
  };
}

/**
 * Update a workspace's name, description, color, or icon. Requires owner or editor role.
 */
export function updateWorkspace(
  workspaceId: number,
  userId: number,
  data: { name?: string; description?: string; color?: string; icon?: string }
): void {
  requireWorkspaceRole(workspaceId, userId, ['owner', 'editor']);

  const updates: string[] = [];
  const params: unknown[] = [];

  if (data.name !== undefined) {
    updates.push('name = ?');
    params.push(data.name);
  }

  if (data.description !== undefined) {
    updates.push('description = ?');
    params.push(data.description);
  }

  if (data.color !== undefined) {
    updates.push('color = ?');
    params.push(data.color);
  }

  if (data.icon !== undefined) {
    updates.push('icon = ?');
    params.push(data.icon);
  }

  if (updates.length === 0) {
    throw AppError.badRequest('No fields to update');
  }

  params.push(workspaceId);

  const db = getDatabase();
  const result = db.prepare(`UPDATE workspaces SET ${updates.join(', ')} WHERE id = ?`).run(...params);

  if (result.changes === 0) {
    throw AppError.notFound('Workspace not found');
  }
}

/**
 * Delete a workspace. Only the owner can delete, and the default workspace cannot be deleted.
 */
export function deleteWorkspace(workspaceId: number, userId: number): void {
  requireWorkspaceRole(workspaceId, userId, ['owner']);

  const db = getDatabase();

  const workspace = db
    .prepare('SELECT is_default FROM workspaces WHERE id = ?')
    .get(workspaceId) as { is_default: number } | undefined;

  if (!workspace) {
    throw AppError.notFound('Workspace not found');
  }

  if (workspace.is_default === 1) {
    throw AppError.badRequest('Cannot delete the default workspace');
  }

  db.prepare('DELETE FROM workspaces WHERE id = ?').run(workspaceId);
}
