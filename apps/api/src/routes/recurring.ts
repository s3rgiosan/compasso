import { Router } from 'express';
import {
  detectRecurringPatterns,
  getRecurringPatterns,
  deletePattern,
  getPatternTransactions,
  updatePattern,
} from '../services/recurringDetector.js';
import { authMiddleware } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { validate } from '../middleware/validate.js';
import { idParam } from '../schemas/common.js';
import { detectRecurringSchema, updatePatternSchema } from '../schemas/recurring.js';
import { requireQueryInt } from '../utils/queryHelpers.js';
import { requireWorkspaceMembership } from '../services/workspaceService.js';
import { AppError } from '../errors.js';

const router = Router();

// Apply auth middleware to all routes
router.use(authMiddleware);

// GET /api/recurring
// Query param: ?workspaceId=1 (required)
router.get('/', asyncHandler((req, res) => {
  const workspaceId = requireQueryInt(req, 'workspaceId');
  requireWorkspaceMembership(workspaceId, req.user!.id);
  const patterns = getRecurringPatterns(workspaceId);

  res.json({
    success: true,
    data: patterns,
  });
}));

// POST /api/recurring/detect
// Body: { workspaceId: number }
router.post('/detect', validate({ body: detectRecurringSchema }), asyncHandler((req, res) => {
  const { workspaceId } = req.body;
  requireWorkspaceMembership(workspaceId, req.user!.id);

  const result = detectRecurringPatterns(workspaceId);

  res.json({
    success: true,
    data: {
      detected: result.detected,
      totalPatterns: result.patterns.length,
    },
  });
}));

// GET /api/recurring/:id/transactions
// Query param: ?workspaceId=1 (required)
router.get('/:id/transactions', validate({ params: idParam }), asyncHandler((req, res) => {
  const { id } = req.params as unknown as { id: number };
  const workspaceId = requireQueryInt(req, 'workspaceId');
  requireWorkspaceMembership(workspaceId, req.user!.id);

  const transactions = getPatternTransactions(id, workspaceId);

  res.json({
    success: true,
    data: transactions,
  });
}));

// PUT /api/recurring/:id
// Body: { descriptionPattern?, frequency?, avgAmount?, isActive? }
// Query param: ?workspaceId=1 (required)
router.put('/:id', validate({ body: updatePatternSchema, params: idParam }), asyncHandler((req, res) => {
  const { id } = req.params as unknown as { id: number };
  const workspaceId = requireQueryInt(req, 'workspaceId');
  requireWorkspaceMembership(workspaceId, req.user!.id);
  const { descriptionPattern, frequency, avgAmount, isActive } = req.body;

  const success = updatePattern(id, req.user!.id, { descriptionPattern, frequency, avgAmount, isActive });

  if (!success) {
    throw AppError.notFound('Pattern not found');
  }

  res.json({
    success: true,
  });
}));

// DELETE /api/recurring/:id
// Query param: ?workspaceId=1 (required)
router.delete('/:id', validate({ params: idParam }), asyncHandler((req, res) => {
  const { id } = req.params as unknown as { id: number };
  const workspaceId = requireQueryInt(req, 'workspaceId');
  requireWorkspaceMembership(workspaceId, req.user!.id);

  const success = deletePattern(id, req.user!.id);

  if (!success) {
    throw AppError.notFound('Pattern not found');
  }

  res.json({
    success: true,
  });
}));

export default router;
