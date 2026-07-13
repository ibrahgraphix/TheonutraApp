import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { ApiError } from './error.middleware.js';

/**
 * Returns an Express middleware that validates req.body against the given Zod schema.
 * On success the body is replaced with the parsed (and potentially coerced) value.
 * On failure a 422 ApiError is thrown with the full Zod issue list as details.
 *
 * Usage:
 *   router.post('/login', validate(LoginSchema), authController.login);
 */
export function validate<T>(schema: ZodSchema<T>) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const details = (result.error as ZodError).issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      }));
      return next(new ApiError(422, 'Validation failed', details));
    }
    req.body = result.data;
    next();
  };
}
