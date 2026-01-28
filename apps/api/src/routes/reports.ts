import { Router } from 'express';
import {
  getYearlySummary,
  getCategoryTrends,
  getAvailableYearsForReports,
} from '../services/reportsService.js';
import { authMiddleware } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { requireQueryInt, optionalQueryInt } from '../utils/queryHelpers.js';
import { requireWorkspaceMembership } from '../services/workspaceService.js';

const router = Router();

// Apply auth middleware to all routes
router.use(authMiddleware);

// GET /api/reports/years
// Query param: ?workspaceId=1 (required)
router.get('/years', asyncHandler((req, res) => {
  const workspaceId = requireQueryInt(req, 'workspaceId');
  requireWorkspaceMembership(workspaceId, req.user!.id);
  const years = getAvailableYearsForReports(workspaceId);

  res.json({
    success: true,
    data: years,
  });
}));

// GET /api/reports/yearly
// Query params: ?workspaceId=1&year=2024 (both required)
router.get('/yearly', asyncHandler((req, res) => {
  const workspaceId = requireQueryInt(req, 'workspaceId');
  requireWorkspaceMembership(workspaceId, req.user!.id);
  const year = requireQueryInt(req, 'year');

  const summary = getYearlySummary(workspaceId, year);

  res.json({
    success: true,
    data: summary,
  });
}));

// GET /api/reports/category-trends
// Query params: ?workspaceId=1&months=12 (workspaceId required, months optional)
router.get('/category-trends', asyncHandler((req, res) => {
  const workspaceId = requireQueryInt(req, 'workspaceId');
  requireWorkspaceMembership(workspaceId, req.user!.id);
  const months = optionalQueryInt(req, 'months', 12)!;

  const trends = getCategoryTrends(workspaceId, months);

  res.json({
    success: true,
    data: trends,
  });
}));

export default router;
