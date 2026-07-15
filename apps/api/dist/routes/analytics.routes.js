import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { getMonthlyOverviewHandler, getOrderHistoryHandler, } from '../controllers/analytics.controller.js';
const router = Router();
// Apply auth middleware to all analytics routes
router.use(authMiddleware);
// GET /api/analytics/overview — monthly overview
router.get('/overview', getMonthlyOverviewHandler);
// GET /api/analytics/orders — paginated order history
router.get('/orders', getOrderHistoryHandler);
export default router;
//# sourceMappingURL=analytics.routes.js.map