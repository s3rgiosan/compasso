import type { Request, Response, NextFunction } from 'express';
import { ErrorCode } from '@compasso/shared';
import { AppError } from '../errors.js';
import { config } from '../config.js';

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      error: err.message,
      code: err.code,
    });
    return;
  }

  console.error('Unhandled error:', err);

  res.status(500).json({
    success: false,
    error: config.isProduction ? 'Internal server error' : err.message || 'Internal server error',
    code: ErrorCode.INTERNAL_ERROR,
  });
}
