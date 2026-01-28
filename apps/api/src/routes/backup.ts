import { Router } from 'express';
import multer from 'multer';
import { authMiddleware } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { requireQueryInt } from '../utils/queryHelpers.js';
import { exportWorkspaceData, importWorkspaceData } from '../services/backupService.js';
import { requireWorkspaceMembership, requireWorkspaceRole } from '../services/workspaceService.js';
import { AppError } from '../errors.js';
import { ErrorCode } from '@compasso/shared';
import { workspaceBackupSchema } from '../schemas/backup.js';
import { formatZodError } from '../middleware/validate.js';
import { ZodError } from 'zod';

const router = Router();

router.use(authMiddleware);

// Configure multer for JSON backup files
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'application/json') {
      cb(null, true);
    } else {
      cb(new Error('Only JSON files are allowed'));
    }
  },
});

// GET /api/backup/export?workspaceId=<id>
// Any workspace member can export
router.get('/export', asyncHandler((req, res) => {
  const workspaceId = requireQueryInt(req, 'workspaceId');

  requireWorkspaceMembership(workspaceId, req.user!.id);

  const backup = exportWorkspaceData(workspaceId);

  const filename = `compasso-backup-${backup.workspace.name.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}-${new Date().toISOString().slice(0, 10)}.json`;

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(JSON.stringify(backup, null, 2));
}));

// POST /api/backup/import?workspaceId=<id>
// Only owner or editor can import
router.post('/import', upload.single('file'), asyncHandler((req, res) => {
  if (!req.file) {
    throw AppError.badRequest('No file uploaded', ErrorCode.INVALID_FILE);
  }

  const workspaceId = requireQueryInt(req, 'workspaceId');

  requireWorkspaceRole(workspaceId, req.user!.id, ['owner', 'editor']);

  // Parse JSON from uploaded file
  let parsed: unknown;
  try {
    parsed = JSON.parse(req.file.buffer.toString('utf-8'));
  } catch {
    throw AppError.badRequest('Invalid JSON file');
  }

  // Validate backup structure with Zod
  let backup;
  try {
    backup = workspaceBackupSchema.parse(parsed);
  } catch (err) {
    if (err instanceof ZodError) {
      throw AppError.badRequest(`Invalid backup file structure: ${formatZodError(err)}`);
    }
    throw err;
  }

  const stats = importWorkspaceData(workspaceId, backup);

  res.json({
    success: true,
    data: stats,
  });
}));

export default router;
