import { Request, Response, NextFunction } from 'express';
import * as referralService from '../services/referral.service.js';
import { ApiError } from '../middleware/error.middleware.js';

/**
 * GET /api/referral/me
 * Returns the authenticated user's referral code and shareable link.
 */
export async function getMyReferralInfoHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) {
      throw new ApiError(401, 'Unauthorized');
    }
    const referralInfo = await referralService.getMyReferralInfo(req.user.id);
    res.status(200).json(referralInfo);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/referral/validate/:code
 * Validates a referral code and returns the distributor info if valid.
 * Public endpoint used pre-signup.
 */
export async function validateReferralCodeHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { code } = req.params;
    if (!code || Array.isArray(code)) {
      throw new ApiError(400, 'Referral code is required');
    }
    const validation = await referralService.validateReferralCode(code as string);
    res.status(200).json(validation);
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/referral/:distributorId/regenerate
 * Regenerates a new referral code for a distributor. Staff only.
 */
export async function regenerateReferralCodeHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { distributorId } = req.params;
    if (!distributorId || Array.isArray(distributorId)) {
      throw new ApiError(400, 'Distributor ID is required');
    }
    const newCode = await referralService.regenerateReferralCode(distributorId as string);
    res.status(200).json({
      referral_code: newCode,
      message: 'Referral code regenerated successfully',
    });
  } catch (err) {
    next(err);
  }
}
