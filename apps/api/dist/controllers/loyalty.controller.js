import * as loyaltyService from '../services/loyalty.service.js';
import { ApiError } from '../middleware/error.middleware.js';
export async function getMyLoyaltyHandler(req, res, next) {
    try {
        if (!req.user) {
            throw new ApiError(401, 'Unauthorized');
        }
        const balance = await loyaltyService.getMyLoyaltyBalance(req.user.id);
        const history = await loyaltyService.getMyLoyaltyHistory(req.user.id);
        res.status(200).json({ balance: balance.balance, updatedAt: balance.updated_at, history });
    }
    catch (err) {
        next(err);
    }
}
//# sourceMappingURL=loyalty.controller.js.map