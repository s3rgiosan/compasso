import type { Request } from 'express';
import { AppError } from '../errors.js';

export function requireQueryInt(req: Request, name: string): number {
  const val = req.query[name];
  if (!val) throw AppError.badRequest(`${name} is required`);
  const parsed = parseInt(val as string);
  if (isNaN(parsed)) throw AppError.badRequest(`${name} must be a valid integer`);
  return parsed;
}

export function optionalQueryInt(req: Request, name: string, defaultVal?: number): number | undefined {
  const val = req.query[name];
  if (!val) return defaultVal;
  const parsed = parseInt(val as string);
  if (isNaN(parsed)) throw AppError.badRequest(`${name} must be a valid integer`);
  return parsed;
}

export function optionalQueryString(req: Request, name: string): string | undefined {
  return req.query[name] as string | undefined;
}
