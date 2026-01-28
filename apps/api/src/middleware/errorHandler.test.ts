import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { ErrorCode } from '@compasso/shared';
import { AppError } from '../errors.js';
import { errorHandler } from './errorHandler.js';

describe('errorHandler', () => {
  let req: Request;
  let res: Response;
  let next: NextFunction;

  beforeEach(() => {
    req = {} as Request;
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    } as unknown as Response;
    next = vi.fn();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should handle AppError with its status and code', () => {
    const error = AppError.badRequest('Invalid input');

    errorHandler(error, req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: 'Invalid input',
      code: ErrorCode.VALIDATION_ERROR,
    });
  });

  it('should handle AppError with 404 status', () => {
    const error = AppError.notFound('Not found');

    errorHandler(error, req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: 'Not found',
      code: ErrorCode.NOT_FOUND,
    });
  });

  it('should handle AppError with 500 status', () => {
    const error = AppError.internal('Server error');

    errorHandler(error, req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: 'Server error',
      code: ErrorCode.INTERNAL_ERROR,
    });
  });

  it('should handle unknown errors as 500 with INTERNAL_ERROR code', () => {
    const error = new Error('Something unexpected');

    errorHandler(error, req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: 'Something unexpected',
      code: ErrorCode.INTERNAL_ERROR,
    });
    expect(console.error).toHaveBeenCalledWith('Unhandled error:', error);
  });

  it('should handle errors without message', () => {
    const error = new Error();

    errorHandler(error, req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: 'Internal server error',
      code: ErrorCode.INTERNAL_ERROR,
    });
  });
});
