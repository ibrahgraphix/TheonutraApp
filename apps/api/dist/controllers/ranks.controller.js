import * as ranksService from '../services/ranks.service.js';
import { ApiError } from '../middleware/error.middleware.js';
/**
 * GET /api/ranks
 * Returns all ranks in order of level_order.
 */
export async function getRanks(_req, res, next) {
    try {
        const ranks = await ranksService.listRanks();
        res.status(200).json(ranks);
    }
    catch (err) {
        next(err);
    }
}
/**
 * GET /api/ranks/me
 * Returns the rank progress details for the logged-in user.
 */
export async function getMyRankProgress(req, res, next) {
    try {
        if (!req.user) {
            throw new ApiError(401, 'Unauthorized');
        }
        const progress = await ranksService.getRankProgress(req.user.id);
        res.status(200).json(progress);
    }
    catch (err) {
        next(err);
    }
}
/**
 * PATCH /api/ranks/:distributorId/promote
 * Staff only. Promotes a distributor to a new rank.
 */
export async function promoteDistributorHandler(req, res, next) {
    try {
        if (!req.user) {
            throw new ApiError(401, 'Unauthorized');
        }
        const { distributorId } = req.params;
        if (!distributorId) {
            throw new ApiError(400, 'Distributor ID is required');
        }
        const { newRankId } = req.body;
        await ranksService.promoteDistributor(distributorId, newRankId, req.user.id);
        res.status(200).json({ message: 'Distributor promoted successfully' });
    }
    catch (err) {
        next(err);
    }
}
//# sourceMappingURL=ranks.controller.js.map