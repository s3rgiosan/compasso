import { getDatabase } from '../db/database.js';
import { AppError } from '../errors.js';
import { getMemberRole, requireWorkspaceRole, requireWorkspaceMembership } from './workspaceService.js';
import { ErrorCode } from '@compasso/shared';

interface InvitationRow {
  id: number;
  workspaceId: number;
  workspaceName: string;
  workspaceColor: string;
  role: string;
  status: string;
  createdAt: string;
  respondedAt: string | null;
  invitedUserId: number;
  invitedUsername: string;
  invitedDisplayName: string | null;
  invitedById: number;
  invitedByUsername: string;
  invitedByDisplayName: string | null;
}

interface InvitationRecord {
  workspace_id: number;
  role: string;
}

interface FormattedMember {
  id: number;
  workspaceId: number;
  userId: number;
  username: string;
  displayName: string | null;
  email: string | null;
  role: string;
  createdAt: string;
}

interface FormattedInvitation {
  id: number;
  workspaceId: number;
  workspaceName: string;
  workspaceColor: string;
  invitedBy: { id: number; username: string; displayName: string | null };
  invitedUser?: { id: number; username: string; displayName: string | null };
  role: string;
  status: string;
  createdAt: string;
  respondedAt: string | null;
}

/**
 * List all members of a workspace. Requires workspace membership.
 */
export function listMembers(workspaceId: number, userId: number): FormattedMember[] {
  requireWorkspaceMembership(workspaceId, userId);

  const db = getDatabase();
  const members = db
    .prepare(
      `SELECT wm.id, wm.workspace_id as workspaceId, wm.user_id as userId,
              u.username, u.display_name as displayName, u.email,
              wm.role, wm.created_at as createdAt
       FROM workspace_members wm
       JOIN users u ON u.id = wm.user_id
       WHERE wm.workspace_id = ?
       ORDER BY
         CASE wm.role WHEN 'owner' THEN 0 WHEN 'editor' THEN 1 ELSE 2 END,
         wm.created_at ASC`
    )
    .all(workspaceId) as FormattedMember[];

  return members;
}

/**
 * Invite a user to a workspace by username or email. Requires owner or editor role.
 */
export function inviteUser(
  workspaceId: number,
  inviterId: number,
  usernameOrEmail: string,
  role: string
): number {
  if (!usernameOrEmail || !role) {
    throw AppError.badRequest('usernameOrEmail and role are required');
  }

  if (!['editor', 'viewer'].includes(role)) {
    throw AppError.badRequest('Role must be editor or viewer');
  }

  requireWorkspaceRole(workspaceId, inviterId, ['owner', 'editor']);

  const db = getDatabase();

  const targetUser = db
    .prepare('SELECT id, username FROM users WHERE username = ? OR email = ?')
    .get(usernameOrEmail, usernameOrEmail) as { id: number; username: string } | undefined;

  if (!targetUser) {
    throw AppError.notFound('User not found', ErrorCode.USER_NOT_FOUND);
  }

  if (targetUser.id === inviterId) {
    throw AppError.badRequest('You cannot invite yourself');
  }

  const existingMember = getMemberRole(workspaceId, targetUser.id);
  if (existingMember) {
    throw AppError.conflict('User is already a member of this workspace', ErrorCode.ALREADY_MEMBER);
  }

  const existingInvitation = db
    .prepare(
      `SELECT id FROM workspace_invitations
       WHERE workspace_id = ? AND invited_user_id = ? AND status = 'pending'`
    )
    .get(workspaceId, targetUser.id);

  if (existingInvitation) {
    throw AppError.conflict('User already has a pending invitation', ErrorCode.ALREADY_INVITED);
  }

  const result = db
    .prepare(
      `INSERT INTO workspace_invitations (workspace_id, invited_by, invited_user_id, role)
       VALUES (?, ?, ?, ?)`
    )
    .run(workspaceId, inviterId, targetUser.id, role);

  return Number(result.lastInsertRowid);
}

/**
 * List pending invitations for a workspace. Requires owner or editor role.
 */
export function listWorkspaceInvitations(workspaceId: number, userId: number): FormattedInvitation[] {
  requireWorkspaceRole(workspaceId, userId, ['owner', 'editor']);

  const db = getDatabase();
  const invitations = db
    .prepare(
      `SELECT wi.id, wi.workspace_id as workspaceId,
              w.name as workspaceName, w.color as workspaceColor,
              wi.role, wi.status,
              wi.created_at as createdAt, wi.responded_at as respondedAt,
              u.id as invitedUserId, u.username as invitedUsername,
              u.display_name as invitedDisplayName,
              ib.id as invitedById, ib.username as invitedByUsername,
              ib.display_name as invitedByDisplayName
       FROM workspace_invitations wi
       JOIN workspaces w ON w.id = wi.workspace_id
       JOIN users u ON u.id = wi.invited_user_id
       JOIN users ib ON ib.id = wi.invited_by
       WHERE wi.workspace_id = ? AND wi.status = 'pending'
       ORDER BY wi.created_at DESC`
    )
    .all(workspaceId) as InvitationRow[];

  return invitations.map((inv) => ({
    id: inv.id,
    workspaceId: inv.workspaceId,
    workspaceName: inv.workspaceName,
    workspaceColor: inv.workspaceColor,
    invitedBy: {
      id: inv.invitedById,
      username: inv.invitedByUsername,
      displayName: inv.invitedByDisplayName,
    },
    invitedUser: {
      id: inv.invitedUserId,
      username: inv.invitedUsername,
      displayName: inv.invitedDisplayName,
    },
    role: inv.role,
    status: inv.status,
    createdAt: inv.createdAt,
    respondedAt: inv.respondedAt,
  }));
}

/**
 * Change the role of a workspace member. Only owners can change roles.
 */
export function changeMemberRole(
  workspaceId: number,
  requesterId: number,
  targetUserId: number,
  newRole: string
): void {
  if (!newRole || !['editor', 'viewer'].includes(newRole)) {
    throw AppError.badRequest('Role must be editor or viewer');
  }

  requireWorkspaceRole(workspaceId, requesterId, ['owner']);

  const targetRole = getMemberRole(workspaceId, targetUserId);
  if (!targetRole) {
    throw AppError.notFound('Member not found');
  }

  if (targetRole === 'owner') {
    throw AppError.badRequest('Cannot change the role of the workspace owner');
  }

  const db = getDatabase();
  db.prepare(
    'UPDATE workspace_members SET role = ? WHERE workspace_id = ? AND user_id = ?'
  ).run(newRole, workspaceId, targetUserId);
}

/**
 * Remove a member from a workspace. Owners can remove anyone; members can remove themselves.
 */
export function removeMember(
  workspaceId: number,
  requesterId: number,
  targetUserId: number
): void {
  const currentRole = getMemberRole(workspaceId, requesterId);

  const isSelf = requesterId === targetUserId;
  if (!isSelf && currentRole !== 'owner') {
    throw AppError.forbidden(
      'Only workspace owners can remove members',
      ErrorCode.INSUFFICIENT_PERMISSIONS
    );
  }

  const targetRole = getMemberRole(workspaceId, targetUserId);
  if (!targetRole) {
    throw AppError.notFound('Member not found');
  }

  if (targetRole === 'owner') {
    throw AppError.badRequest('Cannot remove the workspace owner');
  }

  const db = getDatabase();
  db.prepare(
    'DELETE FROM workspace_members WHERE workspace_id = ? AND user_id = ?'
  ).run(workspaceId, targetUserId);
}

/**
 * Get all pending invitations for a user.
 */
export function getMyInvitations(userId: number): FormattedInvitation[] {
  const db = getDatabase();

  const invitations = db
    .prepare(
      `SELECT wi.id, wi.workspace_id as workspaceId,
              w.name as workspaceName, w.color as workspaceColor,
              wi.role, wi.status,
              wi.created_at as createdAt, wi.responded_at as respondedAt,
              ib.id as invitedById, ib.username as invitedByUsername,
              ib.display_name as invitedByDisplayName
       FROM workspace_invitations wi
       JOIN workspaces w ON w.id = wi.workspace_id
       JOIN users ib ON ib.id = wi.invited_by
       WHERE wi.invited_user_id = ? AND wi.status = 'pending'
       ORDER BY wi.created_at DESC`
    )
    .all(userId) as InvitationRow[];

  return invitations.map((inv) => ({
    id: inv.id,
    workspaceId: inv.workspaceId,
    workspaceName: inv.workspaceName,
    workspaceColor: inv.workspaceColor,
    invitedBy: {
      id: inv.invitedById,
      username: inv.invitedByUsername,
      displayName: inv.invitedByDisplayName,
    },
    role: inv.role,
    status: inv.status,
    createdAt: inv.createdAt,
    respondedAt: inv.respondedAt,
  }));
}

/**
 * Accept a pending invitation and add the user as a workspace member.
 */
export function acceptInvitation(invitationId: number, userId: number): void {
  const db = getDatabase();

  const invitation = db
    .prepare(
      `SELECT * FROM workspace_invitations WHERE id = ? AND invited_user_id = ? AND status = 'pending'`
    )
    .get(invitationId, userId) as InvitationRecord | undefined;

  if (!invitation) {
    throw AppError.notFound(
      'Invitation not found or already responded',
      ErrorCode.INVITATION_NOT_FOUND
    );
  }

  const accept = db.transaction(() => {
    db.prepare(
      `UPDATE workspace_invitations SET status = 'accepted', responded_at = datetime('now') WHERE id = ?`
    ).run(invitationId);

    db.prepare(
      `INSERT OR IGNORE INTO workspace_members (workspace_id, user_id, role) VALUES (?, ?, ?)`
    ).run(invitation.workspace_id, userId, invitation.role);
  });

  accept();
}

/**
 * Decline a pending invitation.
 */
export function declineInvitation(invitationId: number, userId: number): void {
  const db = getDatabase();

  const invitation = db
    .prepare(
      `SELECT * FROM workspace_invitations WHERE id = ? AND invited_user_id = ? AND status = 'pending'`
    )
    .get(invitationId, userId) as InvitationRecord | undefined;

  if (!invitation) {
    throw AppError.notFound(
      'Invitation not found or already responded',
      ErrorCode.INVITATION_NOT_FOUND
    );
  }

  db.prepare(
    `UPDATE workspace_invitations SET status = 'declined', responded_at = datetime('now') WHERE id = ?`
  ).run(invitationId);
}
