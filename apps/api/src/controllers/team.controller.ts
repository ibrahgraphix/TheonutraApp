import { Request, Response, NextFunction } from 'express';
import * as teamService from '../services/team.service.js';
import { ApiError } from '../middleware/error.middleware.js';

/**
 * GET /api/team
 * Returns the authenticated user's direct recruits (level = 1).
 * The user's own UUID from the JWT is used — no route param accepted,
 * making cross-inspection structurally impossible.
 */
export async function getDirectRecruitsHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) {
      throw new ApiError(401, 'Unauthorized');
    }

    const members = await teamService.getDirectRecruits(req.user.id);
    res.status(200).json(members);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/team/full
 * Returns the authenticated user's full multi-level downline as a flat list.
 * Frontend builds the nested tree using `referredBy` + `level`.
 */
export async function getMyTeamHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) {
      throw new ApiError(401, 'Unauthorized');
    }

    const members = await teamService.getMyTeam(req.user.id);
    res.status(200).json(members);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/team/counts  (staff-only — mounted with requireStaff in the router)
 * Returns a map of { [distributorId]: directRecruitCount } for all distributors.
 * Complements the inline count already present in sellers.service.ts listSellers.
 */
export async function getTeamCountsHandler(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const counts = await teamService.getTeamCountsBySeller();
    res.status(200).json(counts);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/team/:id  (staff-only — mounted with requireStaff in the router)
 * Returns the FULL multi-level downline for ANY distributor, not just the
 * requester's own. This is the one staff exception to the "no :id" rule
 * enforced on the self-service /team and /team/full routes above — a
 * regular distributor has no route that accepts an id, so this is only
 * reachable by admin/company_staff (enforced by requireStaff in the router,
 * not by anything in this handler — don't rely on this function alone for
 * that guarantee).
 *
 * Powers the Manage → Distributors → tap a distributor → chain view.
 */
export async function getTeamForDistributorHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { id } = req.params;
    if (!id) {
      throw new ApiError(400, 'Distributor id is required');
    }

    // Reuses the same downline_tree query as getMyTeam — just rooted at
    // the id from the URL instead of the requester's own id.
    const members = await teamService.getMyTeam(id);
    res.status(200).json(members);
  } catch (err) {
    next(err);
  }
}