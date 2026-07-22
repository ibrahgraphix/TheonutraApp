import { Request, Response, NextFunction } from 'express';
import * as manualBonusService from '../services/manualBonus.service.js';
import { AwardManualBonusInput } from '../schemas/manualBonus.schema.js';
import { ApiError } from '../middleware/error.middleware.js';

/**
 * POST /api/manual-bonuses
 * Awards a manual bonus. Staff only.
 */
export async function awardBonusHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) {
      throw new ApiError(401, 'Unauthorized');
    }
    const input = req.body as AwardManualBonusInput;
    const bonus = await manualBonusService.awardBonus(
      req.user.id,
      input.distributorId,
      input.bonusCategory,
      input.amount,
      input.note,
    );
    res.status(201).json(bonus);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/manual-bonuses
 * Lists all manual bonuses with optional filters. Staff only.
 */
export async function listAllBonusesHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const page = parseInt(req.query['page'] as string, 10) || 1;
    const limit = parseInt(req.query['limit'] as string, 10) || 20;

    const filters = {
      category: req.query['category'] as string | undefined,
      distributorId: req.query['distributorId'] as string | undefined,
      startDate: req.query['startDate'] as string | undefined,
      endDate: req.query['endDate'] as string | undefined,
    };

    const result = await manualBonusService.listAllBonuses(filters, page, limit);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/manual-bonuses/mine
 * Lists the authenticated user's manual bonus history.
 */
export async function getMyBonusesHandler(
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

    const result = await manualBonusService.listBonusesForDistributor(req.user.id, page, limit);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}
