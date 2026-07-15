import * as commissionsService from '../services/commissions.service.js';
import { ApiError } from '../middleware/error.middleware.js';
/**
 * GET /api/commissions
 * Returns all commissions earned by the logged-in user.
 */
export async function getMyCommissionsHandler(req, res, next) {
    try {
        if (!req.user) {
            throw new ApiError(401, 'Unauthorized');
        }
        const commissions = await commissionsService.getMyCommissions(req.user.id);
        res.status(200).json(commissions);
    }
    catch (err) {
        next(err);
    }
}
/**
 * GET /api/commissions/summary?month=YYYY-MM
 * Returns total commission earned by the logged-in user in a given month.
 * Defaults to current month if not specified.
 */
export async function getCommissionsSummaryHandler(req, res, next) {
    try {
        if (!req.user) {
            throw new ApiError(401, 'Unauthorized');
        }
        const month = req.query['month'];
        const summary = await commissionsService.getCommissionsSummary(req.user.id, month);
        res.status(200).json(summary);
    }
    catch (err) {
        next(err);
    }
}
//# sourceMappingURL=commissions.controller.js.map