import type { Request, Response, NextFunction } from 'express';
import { ZodError, type ZodSchema } from 'zod';
import { AppError } from '../errors.js';

interface ValidationSchemas {
  body?: ZodSchema;
  params?: ZodSchema;
  query?: ZodSchema;
}

export function formatZodError(error: ZodError): string {
  return error.issues
    .map((issue) => {
      const path = issue.path.length ? issue.path.join('.') : 'value';
      return `${path}: ${issue.message}`;
    })
    .join('; ');
}

export function validate(schemas: ValidationSchemas) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      if (schemas.body) {
        req.body = schemas.body.parse(req.body);
      }
      if (schemas.params) {
        req.params = schemas.params.parse(req.params) as any;
      }
      if (schemas.query) {
        req.query = schemas.query.parse(req.query) as any;
      }
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        next(AppError.badRequest(formatZodError(err)));
        return;
      }
      next(err);
    }
  };
}
