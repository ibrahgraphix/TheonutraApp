import * as teamService from '../services/team.service.js';
import { ApiError } from '../middleware/error.middleware.js';
/**
 * GET /api/team
 * Returns the authenticated user's direct recruits (level = 1).
 * The user's own UUID from the JWT is used — no route param accepted,
 * making cross-inspection structurally impossible.
 */
export async function getDirectRecruitsHandler(req, res, next) {
    try {
        if (!req.user) {
            throw new ApiError(401, 'Unauthorized');
        }
        const members = await teamService.getDirectRecruits(req.user.id);
        res.status(200).json(members);
    }
    catch (err) {
        next(err);
    }
}
/**
 * GET /api/team/full
 * Returns the authenticated user's full multi-level downline as a flat list.
 * Frontend builds the nested tree using `referredBy` + `level`.
 */
export async function getMyTeamHandler(req, res, next) {
    try {
        if (!req.user) {
            throw new ApiError(401, 'Unauthorized');
        }
        const members = await teamService.getMyTeam(req.user.id);
        res.status(200).json(members);
    }
    catch (err) {
        next(err);
    }
}
/**
 * GET /api/team/counts  (staff-only — mounted with requireStaff in the router)
 * Returns a map of { [distributorId]: directRecruitCount } for all distributors.
 * Complements the inline count already present in sellers.service.ts listSellers.
 */
export async function getTeamCountsHandler(_req, res, next) {
    try {
        const counts = await teamService.getTeamCountsBySeller();
        res.status(200).json(counts);
    }
    catch (err) {
        next(err);
    }
}
//# sourceMappingURL=team.controller.js.map