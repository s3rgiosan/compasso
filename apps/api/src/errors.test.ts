import { describe, it, expect } from 'vitest';
import { AppError } from './errors.js';
import { ErrorCode } from '@compasso/shared';

describe('AppError', () => {
  it('should create an error with message, code, and statusCode', () => {
    const error = new AppError('Test error', 'TEST_CODE', 400);

    expect(error.message).toBe('Test error');
    expect(error.code).toBe('TEST_CODE');
    expect(error.statusCode).toBe(400);
    expect(error.name).toBe('AppError');
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(AppError);
  });

  describe('factory methods', () => {
    it('badRequest should create 400 error with VALIDATION_ERROR code by default', () => {
      const error = AppError.badRequest('Bad input');

      expect(error.statusCode).toBe(400);
      expect(error.code).toBe(ErrorCode.VALIDATION_ERROR);
      expect(error.message).toBe('Bad input');
    });

    it('badRequest should accept custom code', () => {
      const error = AppError.badRequest('Bad input', ErrorCode.DUPLICATE_RESOURCE);

      expect(error.statusCode).toBe(400);
      expect(error.code).toBe(ErrorCode.DUPLICATE_RESOURCE);
    });

    it('unauthorized should create 401 error with AUTH_REQUIRED code by default', () => {
      const error = AppError.unauthorized('Not logged in');

      expect(error.statusCode).toBe(401);
      expect(error.code).toBe(ErrorCode.AUTH_REQUIRED);
      expect(error.message).toBe('Not logged in');
    });

    it('unauthorized should accept custom code', () => {
      const error = AppError.unauthorized('Session expired', ErrorCode.SESSION_EXPIRED);

      expect(error.statusCode).toBe(401);
      expect(error.code).toBe(ErrorCode.SESSION_EXPIRED);
    });

    it('forbidden should create 403 error with FORBIDDEN code by default', () => {
      const error = AppError.forbidden('Access denied');

      expect(error.statusCode).toBe(403);
      expect(error.code).toBe(ErrorCode.FORBIDDEN);
      expect(error.message).toBe('Access denied');
    });

    it('notFound should create 404 error with NOT_FOUND code by default', () => {
      const error = AppError.notFound('Resource missing');

      expect(error.statusCode).toBe(404);
      expect(error.code).toBe(ErrorCode.NOT_FOUND);
      expect(error.message).toBe('Resource missing');
    });

    it('conflict should create 409 error with DUPLICATE_RESOURCE code by default', () => {
      const error = AppError.conflict('Already exists');

      expect(error.statusCode).toBe(409);
      expect(error.code).toBe(ErrorCode.DUPLICATE_RESOURCE);
      expect(error.message).toBe('Already exists');
    });

    it('internal should create 500 error with INTERNAL_ERROR code by default', () => {
      const error = AppError.internal('Server broke');

      expect(error.statusCode).toBe(500);
      expect(error.code).toBe(ErrorCode.INTERNAL_ERROR);
      expect(error.message).toBe('Server broke');
    });
  });
});
