import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { authMiddleware } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { validate } from '../middleware/validate.js';
import { idParam } from '../schemas/common.js';
import { requireQueryInt, optionalQueryInt } from '../utils/queryHelpers.js';
import { processUpload, listLedgers, deleteLedger } from '../services/uploadService.js';
import { requireWorkspaceMembership } from '../services/workspaceService.js';
import { AppError } from '../errors.js';
import { ErrorCode } from '@compasso/shared';
import { SUPPORTED_BANKS, BANK_CONFIGS } from '../parsers/registry.js';

const router = Router();

router.use(authMiddleware);

// Configure multer for file uploads
const uploadsDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'));
    }
  },
});

// POST /api/upload
router.post('/', upload.single('file'), asyncHandler(async (req, res) => {
  if (!req.file) {
    throw AppError.badRequest('No file uploaded', ErrorCode.INVALID_FILE);
  }

  // Validate PDF magic bytes (%PDF) regardless of client-sent mimetype
  const pdfMagic = req.file.buffer.subarray(0, 4).toString('ascii');
  if (pdfMagic !== '%PDF') {
    throw AppError.badRequest('File is not a valid PDF', ErrorCode.INVALID_FILE);
  }

  const workspaceId = requireQueryInt(req, 'workspaceId');
  requireWorkspaceMembership(workspaceId, req.user!.id);
  const bankId = (req.query.bank as string) || SUPPORTED_BANKS.NOVO_BANCO;

  const response = await processUpload(
    req.file.buffer,
    req.file.originalname,
    bankId,
    workspaceId
  );

  res.json({ success: true, data: response });
}));

// GET /api/upload/ledgers
router.get('/ledgers', asyncHandler((req, res) => {
  const workspaceId = requireQueryInt(req, 'workspaceId');
  requireWorkspaceMembership(workspaceId, req.user!.id);
  const limit = optionalQueryInt(req, 'limit', 20)!;
  const offset = optionalQueryInt(req, 'offset', 0)!;

  const result = listLedgers(workspaceId, limit, offset);
  res.json({ success: true, data: result });
}));

// GET /api/upload/banks
router.get('/banks', (_req, res) => {
  const banks = Object.values(BANK_CONFIGS).map((config) => ({
    id: config.id,
    name: config.name,
    country: config.country,
    currency: config.currency,
  }));

  res.json({ success: true, data: banks });
});

// DELETE /api/upload/ledgers/:id
router.delete('/ledgers/:id', validate({ params: idParam }), asyncHandler((req, res) => {
  const { id } = req.params as unknown as { id: number };
  deleteLedger(id, req.user!.id);
  res.json({ success: true });
}));

export default router;
