import * as teamBonusService from '../services/teamBonus.service.js';
import { ApiError } from '../middleware/error.middleware.js';
/**
 * GET /api/team-bonus/my-summary?period=YYYY-MM
 * Returns team bonus summary for the authenticated distributor.
 */
export async function getMyTeamBonusSummaryHandler(req, res, next) {
    try {
        if (!req.user) {
            throw new ApiError(401, 'Unauthorized');
        }
        const period = req.query['period'];
        if (!period) {
            // Default to current month
            const now = new Date();
            const year = now.getUTCFullYear();
            const month = String(now.getUTCMonth() + 1).padStart(2, '0');
            const defaultPeriod = `${year}-${month}`;
            const summary = await teamBonusService.calculateTeamBonus(req.user.id, defaultPeriod);
            res.status(200).json(summary);
            return;
        }
        // Validate period format
        if (!/^\d{4}-\d{2}$/.test(period)) {
            throw new ApiError(400, 'Period must be in YYYY-MM format');
        }
        const summary = await teamBonusService.calculateTeamBonus(req.user.id, period);
        res.status(200).json(summary);
    }
    catch (err) {
        next(err);
    }
}
/**
 * GET /api/team-bonus/history?page=1&limit=20
 * Returns paginated team bonus history for the authenticated distributor.
 */
export async function getTeamBonusHistoryHandler(req, res, next) {
    try {
        if (!req.user) {
            throw new ApiError(401, 'Unauthorized');
        }
        const page = parseInt(req.query['page'], 10) || 1;
        const limit = parseInt(req.query['limit'], 10) || 20;
        const result = await teamBonusService.getTeamBonusHistory(req.user.id, page, limit);
        res.status(200).json(result);
    }
    catch (err) {
        next(err);
    }
}
/**
 * POST /api/team-bonus/run (staff only)
 * Triggers team bonus calculation for all distributors for a given period.
 */
export async function runTeamBonusBatchHandler(req, res, next) {
    try {
        if (!req.user) {
            throw new ApiError(401, 'Unauthorized');
        }
        const input = req.body;
        const result = await teamBonusService.runTeamBonusBatch(input.period, req.user.id);
        res.status(200).json(result);
    }
    catch (err) {
        next(err);
    }
}
/**
 * GET /api/team-bonus/rates (staff only)
 * Returns team bonus rates configuration.
 */
export async function getTeamBonusRatesHandler(req, res, next) {
    try {
        const rates = await teamBonusService.getTeamBonusRates();
        res.status(200).json(rates);
    }
    catch (err) {
        next(err);
    }
}
/**
 * PUT /api/team-bonus/rates (staff only)
 * Updates team bonus rates configuration.
 */
export async function updateTeamBonusRatesHandler(req, res, next) {
    try {
        const input = req.body;
        await teamBonusService.updateTeamBonusRates(input.rates);
        res.status(200).json({ message: 'Team bonus rates updated successfully' });
    }
    catch (err) {
        next(err);
    }
}
//# sourceMappingURL=teamBonus.controller.js.map