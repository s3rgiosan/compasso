import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { validate } from '../middleware/validate.js';
import { idParam, workspaceIdParam, workspaceAndUserIdParams } from '../schemas/common.js';
import { inviteUserSchema, changeMemberRoleSchema } from '../schemas/invitations.js';
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

const router = Router();

router.use(authMiddleware);

// GET /workspaces/:workspaceId/members
router.get('/:workspaceId/members', validate({ params: workspaceIdParam }), asyncHandler((req, res) => {
  const { workspaceId } = req.params as unknown as { workspaceId: number };
  const members = listMembers(workspaceId, req.user!.id);
  res.json({ success: true, data: members });
}));

// POST /workspaces/:workspaceId/invitations
router.post('/:workspaceId/invitations', validate({ body: inviteUserSchema, params: workspaceIdParam }), asyncHandler((req, res) => {
  const { workspaceId } = req.params as unknown as { workspaceId: number };
  const { usernameOrEmail, role } = req.body;
  const id = inviteUser(workspaceId, req.user!.id, usernameOrEmail, role);
  res.status(201).json({ success: true, data: { id } });
}));

// GET /workspaces/:workspaceId/invitations
router.get('/:workspaceId/invitations', validate({ params: workspaceIdParam }), asyncHandler((req, res) => {
  const { workspaceId } = req.params as unknown as { workspaceId: number };
  const invitations = listWorkspaceInvitations(workspaceId, req.user!.id);
  res.json({ success: true, data: invitations });
}));

// PUT /workspaces/:workspaceId/members/:userId
router.put('/:workspaceId/members/:userId', validate({ body: changeMemberRoleSchema, params: workspaceAndUserIdParams }), asyncHandler((req, res) => {
  const { workspaceId, userId: targetUserId } = req.params as unknown as { workspaceId: number; userId: number };
  const { role } = req.body;
  changeMemberRole(workspaceId, req.user!.id, targetUserId, role);
  res.json({ success: true });
}));

// DELETE /workspaces/:workspaceId/members/:userId
router.delete('/:workspaceId/members/:userId', validate({ params: workspaceAndUserIdParams }), asyncHandler((req, res) => {
  const { workspaceId, userId: targetUserId } = req.params as unknown as { workspaceId: number; userId: number };
  removeMember(workspaceId, req.user!.id, targetUserId);
  res.json({ success: true });
}));

// GET /invitations (mounted at /api/invitations)
router.get('/', asyncHandler((req, res) => {
  const invitations = getMyInvitations(req.user!.id);
  res.json({ success: true, data: invitations });
}));

// POST /invitations/:id/accept
router.post('/:id/accept', validate({ params: idParam }), asyncHandler((req, res) => {
  const { id: invitationId } = req.params as unknown as { id: number };
  acceptInvitation(invitationId, req.user!.id);
  res.json({ success: true });
}));

// POST /invitations/:id/decline
router.post('/:id/decline', validate({ params: idParam }), asyncHandler((req, res) => {
  const { id: invitationId } = req.params as unknown as { id: number };
  declineInvitation(invitationId, req.user!.id);
  res.json({ success: true });
}));

export default router;
