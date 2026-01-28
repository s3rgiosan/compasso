import type { Request, Response, NextFunction, RequestHandler } from 'express';

type RouteHandler = (req: Request, res: Response, next: NextFunction) => void | Promise<void>;

export function asyncHandler(fn: RouteHandler): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
