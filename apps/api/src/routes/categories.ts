import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { validate } from '../middleware/validate.js';
import { idParam } from '../schemas/common.js';
import {
  createCategorySchema,
  updateCategorySchema,
  addPatternSchema,
  quickPatternSchema,
  categoryPatternParams,
} from '../schemas/categories.js';
import { AppError } from '../errors.js';
import { requireQueryInt, optionalQueryInt } from '../utils/queryHelpers.js';
import {
  listCategories,
  getCategoryWithPatterns,
  checkPatternExists,
  createCategory,
  updateCategory,
  deleteCategory,
  createQuickPattern,
  createPattern,
  deletePattern,
} from '../services/categoryService.js';
import { requireWorkspaceMembership } from '../services/workspaceService.js';
import type { BankId } from '@compasso/shared';

const router = Router();

router.use(authMiddleware);

// GET /api/categories
router.get('/', asyncHandler((req, res) => {
  const workspaceId = requireQueryInt(req, 'workspaceId');
  requireWorkspaceMembership(workspaceId, req.user!.id);
  const limit = optionalQueryInt(req, 'limit', 50)!;
  const offset = optionalQueryInt(req, 'offset', 0)!;

  const result = listCategories(workspaceId, limit, offset);
  res.json({ success: true, data: result });
}));

// GET /api/categories/:id
router.get('/:id', asyncHandler((req, res) => {
  const id = parseInt(req.params.id);
  const workspaceId = requireQueryInt(req, 'workspaceId');
  requireWorkspaceMembership(workspaceId, req.user!.id);
  const bankId = req.query.bank as BankId | undefined;

  const result = getCategoryWithPatterns(id, workspaceId, bankId);
  res.json({ success: true, data: result });
}));

// GET /api/categories/patterns/exists
router.get('/patterns/exists', asyncHandler((req, res) => {
  const workspaceId = requireQueryInt(req, 'workspaceId');
  requireWorkspaceMembership(workspaceId, req.user!.id);
  const bankId = req.query.bankId as string | undefined;
  const pattern = req.query.pattern as string | undefined;

  if (!bankId || !pattern) {
    throw AppError.badRequest('workspaceId, bankId, and pattern are required');
  }

  const result = checkPatternExists(workspaceId, bankId, pattern);
  res.json({ success: true, data: result });
}));

// POST /api/categories
router.post('/', validate({ body: createCategorySchema }), asyncHandler((req, res) => {
  const { name, color, icon, workspaceId } = req.body;
  requireWorkspaceMembership(workspaceId, req.user!.id);

  const category = createCategory({ name, color, icon, workspaceId });
  res.status(201).json({ success: true, data: category });
}));

// PUT /api/categories/:id
router.put('/:id', validate({ body: updateCategorySchema, params: idParam }), asyncHandler((req, res) => {
  const { id } = req.params as unknown as { id: number };
  const { workspaceId, name, color, icon } = req.body;
  requireWorkspaceMembership(workspaceId, req.user!.id);

  updateCategory(id, workspaceId, { name, color, icon });
  res.json({ success: true });
}));

// DELETE /api/categories/:id
router.delete('/:id', asyncHandler((req, res) => {
  const id = parseInt(req.params.id);
  const workspaceId = requireQueryInt(req, 'workspaceId');
  requireWorkspaceMembership(workspaceId, req.user!.id);

  deleteCategory(id, workspaceId);
  res.json({ success: true });
}));

// POST /api/categories/:id/patterns/quick
router.post('/:id/patterns/quick', validate({ body: quickPatternSchema, params: idParam }), asyncHandler((req, res) => {
  const { id: categoryId } = req.params as unknown as { id: number };
  const { pattern, bankId, workspaceId, transactionIndices } = req.body;
  requireWorkspaceMembership(workspaceId, req.user!.id);

  const patternId = createQuickPattern(categoryId, workspaceId, bankId, pattern);

  res.status(201).json({
    success: true,
    data: {
      patternId,
      appliedCount: transactionIndices?.length || 0,
    },
  });
}));

// POST /api/categories/:id/patterns
router.post('/:id/patterns', validate({ body: addPatternSchema, params: idParam }), asyncHandler((req, res) => {
  const { id: categoryId } = req.params as unknown as { id: number };
  const { bankId, pattern, workspaceId, priority } = req.body;
  requireWorkspaceMembership(workspaceId, req.user!.id);

  const result = createPattern(categoryId, workspaceId, bankId, pattern, priority);

  res.status(201).json({
    success: true,
    data: {
      id: result.patternId,
      categoryId,
      bankId,
      pattern,
      priority,
      recategorized: result.recategorized,
    },
  });
}));

// DELETE /api/categories/:id/patterns/:patternId
router.delete('/:id/patterns/:patternId', validate({ params: categoryPatternParams }), asyncHandler((req, res) => {
  const { id: categoryId, patternId } = req.params as unknown as { id: number; patternId: number };
  const workspaceId = requireQueryInt(req, 'workspaceId');
  requireWorkspaceMembership(workspaceId, req.user!.id);

  deletePattern(categoryId, patternId, workspaceId);
  res.json({ success: true });
}));

export default router;
