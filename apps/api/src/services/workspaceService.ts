import { getDatabase } from '../db/database.js';
import { AppError } from '../errors.js';
import { ErrorCode } from '@compasso/shared';

/**
 * Get the role of a user within a workspace.
 */
export function getMemberRole(workspaceId: number, userId: number): string | null {
  const db = getDatabase();
  const member = db
    .prepare('SELECT role FROM workspace_members WHERE workspace_id = ? AND user_id = ?')
    .get(workspaceId, userId) as { role: string } | undefined;
  return member?.role ?? null;
}

/**
 * Require that a user holds one of the specified roles in a workspace.
 * Throws AppError.forbidden if the user lacks permission.
 */
export function requireWorkspaceRole(
  workspaceId: number,
  userId: number,
  allowedRoles: string[]
): string {
  const role = getMemberRole(workspaceId, userId);
  if (!role || !allowedRoles.includes(role)) {
    throw AppError.forbidden(
      'You do not have permission to perform this action',
      ErrorCode.INSUFFICIENT_PERMISSIONS
    );
  }
  return role;
}

/**
 * Require that a user is a member of a workspace (any role).
 * Throws AppError.forbidden if the user is not a member.
 */
export function requireWorkspaceMembership(workspaceId: number, userId: number): string {
  const role = getMemberRole(workspaceId, userId);
  if (!role) {
    throw AppError.forbidden(
      'You are not a member of this workspace',
      ErrorCode.INSUFFICIENT_PERMISSIONS
    );
  }
  return role;
}
