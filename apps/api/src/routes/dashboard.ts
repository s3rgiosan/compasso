import { Router } from 'express';
import { getDashboardData, getAvailableYears } from '../services/dashboardService.js';
import { authMiddleware } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { requireQueryInt, optionalQueryInt } from '../utils/queryHelpers.js';
import { requireWorkspaceMembership } from '../services/workspaceService.js';

const router = Router();

// Apply auth middleware to all routes
router.use(authMiddleware);

// GET /api/dashboard
// Query param: ?workspaceId=1 (required)
router.get('/', asyncHandler((req, res) => {
  const workspaceId = requireQueryInt(req, 'workspaceId');
  requireWorkspaceMembership(workspaceId, req.user!.id);
  const year = optionalQueryInt(req, 'year');
  const month = optionalQueryInt(req, 'month');
  const categoryId = optionalQueryInt(req, 'categoryId');

  const data = getDashboardData({ workspaceId, year, month, categoryId });

  res.json({
    success: true,
    data,
  });
}));

// GET /api/dashboard/years
// Query param: ?workspaceId=1 (required)
router.get('/years', asyncHandler((req, res) => {
  const workspaceId = requireQueryInt(req, 'workspaceId');
  requireWorkspaceMembership(workspaceId, req.user!.id);

  const years = getAvailableYears(workspaceId);
  res.json({
    success: true,
    data: years,
  });
}));

export default router;
