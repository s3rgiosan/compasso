import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { validate } from '../middleware/validate.js';
import { idParam } from '../schemas/common.js';
import { createWorkspaceSchema, updateWorkspaceSchema } from '../schemas/workspaces.js';
import {
  listUserWorkspaces,
  getWorkspace,
  createWorkspace,
  updateWorkspace,
  deleteWorkspace,
} from '../services/workspaceManagementService.js';

const router = Router();

router.use(authMiddleware);

// GET /api/workspaces
router.get('/', asyncHandler((req, res) => {
  const workspaces = listUserWorkspaces(req.user!.id);
  res.json({ success: true, data: workspaces });
}));

// GET /api/workspaces/:id
router.get('/:id', validate({ params: idParam }), asyncHandler((req, res) => {
  const { id } = req.params as unknown as { id: number };
  const workspace = getWorkspace(id, req.user!.id);
  res.json({ success: true, data: workspace });
}));

// POST /api/workspaces
router.post('/', validate({ body: createWorkspaceSchema }), asyncHandler((req, res) => {
  const workspace = createWorkspace(req.user!.id, req.body);
  res.status(201).json({ success: true, data: workspace });
}));

// PUT /api/workspaces/:id
router.put('/:id', validate({ body: updateWorkspaceSchema, params: idParam }), asyncHandler((req, res) => {
  const { id } = req.params as unknown as { id: number };
  updateWorkspace(id, req.user!.id, req.body);
  res.json({ success: true });
}));

// DELETE /api/workspaces/:id
router.delete('/:id', validate({ params: idParam }), asyncHandler((req, res) => {
  const { id } = req.params as unknown as { id: number };
  deleteWorkspace(id, req.user!.id);
  res.json({ success: true });
}));

export default router;
