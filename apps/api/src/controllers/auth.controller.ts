import { Request, Response, NextFunction } from 'express';
import { login } from '../services/auth.service.js';

/**
 * POST /api/auth/login
 *
 * Body is pre-validated by validate(LoginSchema) in the route file.
 * This controller just unpacks the validated body, calls the service,
 * and shapes the HTTP response — no business logic here.
 */
export async function loginHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { distributorId, password } = req.body as {
      distributorId: string;
      password: string;
    };

    const result = await login(distributorId, password);

    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}
