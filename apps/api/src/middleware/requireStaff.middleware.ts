import { Request, Response, NextFunction } from 'express';
import { ApiError } from './error.middleware.js';

const STAFF_ROLES = new Set(['admin', 'company_staff']);

/**
 * Guards a route so only admin/company_staff can access it.
 * Must be placed AFTER authMiddleware in the middleware chain —
 * it assumes req.user has already been set.
 */
export function requireStaff(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  if (!req.user) {
    return next(new ApiError(401, 'Authentication required'));
  }

  if (!STAFF_ROLES.has(req.user.role)) {
    return next(new ApiError(403, 'Staff access required'));
  }

  next();
}
