import { Request, Response, NextFunction } from 'express';
import * as loyaltyService from '../services/loyalty.service.js';
import { ApiError } from '../middleware/error.middleware.js';

/**
 * GET /api/loyalty/me
 * Returns loyalty balance and transaction history for the authenticated user.
 */
export async function getMyLoyaltyHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) {
      throw new ApiError(401, 'Unauthorized');
    }
    const page = parseInt(req.query['page'] as string, 10) || 1;
    const limit = parseInt(req.query['limit'] as string, 10) || 20;

    const [balance, history] = await Promise.all([
      loyaltyService.getMyLoyaltyBalance(req.user.id),
      loyaltyService.getMyLoyaltyHistory(req.user.id, page, limit),
    ]);

    res.status(200).json({
      balance: balance.balance,
      history,
    });
  } catch (err) {
    next(err);
  }
}
