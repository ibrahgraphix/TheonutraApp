import { Request, Response, NextFunction } from 'express';
import * as analyticsService from '../services/analytics.service.js';
import { ApiError } from '../middleware/error.middleware.js';

/**
 * GET /api/analytics/overview?month=YYYY-MM
 * Returns monthly overview for the logged-in user.
 */
export async function getMonthlyOverviewHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) {
      throw new ApiError(401, 'Unauthorized');
    }

    const month = req.query['month'] as string | undefined;
    const overview = await analyticsService.getMonthlyOverview(req.user.id, month);
    res.status(200).json(overview);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/analytics/orders?page=1&limit=20
 * Returns paginated order history for the logged-in user.
 */
export async function getOrderHistoryHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) {
      throw new ApiError(401, 'Unauthorized');
    }

    const page = req.query['page'] ? parseInt(String(req.query['page']), 10) : 1;
    const limit = req.query['limit'] ? parseInt(String(req.query['limit']), 10) : 20;
    const orders = await analyticsService.getOrderHistory(req.user.id, page, limit);
    res.status(200).json(orders);
  } catch (err) {
    next(err);
  }
}
