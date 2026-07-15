import { Request, Response, NextFunction } from 'express';
import { ApiError } from './error.middleware.js';

/**
 * Guards a route so only admin can access it.
 * Must be placed AFTER authMiddleware — assumes req.user is set.
 */
export function requireAdmin(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  if (!req.user) {
    return next(new ApiError(401, 'Authentication required'));
  }

  if (req.user.role !== 'admin') {
    return next(new ApiError(403, 'Admin access required'));
  }

  next();
}
