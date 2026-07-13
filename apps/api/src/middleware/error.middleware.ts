import { Request, Response, NextFunction } from 'express';

/**
 * Represents a handled API error with a known HTTP status code.
 * Throw this from services/controllers to short-circuit request handling.
 */
export class ApiError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Centralised error handler — must be the LAST middleware registered in app.ts.
 * Catches both ApiError (intentional) and unexpected errors.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorMiddleware(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof ApiError) {
    res.status(err.statusCode).json({
      error: err.message,
      ...(err.details !== undefined && { details: err.details }),
    });
    return;
  }

  // Unexpected / unhandled errors
  console.error('[unhandled error]', err);
  res.status(500).json({ error: 'Internal server error' });
}
