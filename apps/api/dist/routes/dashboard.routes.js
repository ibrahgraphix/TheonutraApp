import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { requireStaff } from '../middleware/requireStaff.middleware.js';
import { getDashboardSummaryHandler, getPendingPaymentDetailHandler, } from '../controllers/dashboard.controller.js';
const router = Router();
// GET /api/dashboard/summary — staff only
router.get('/summary', authMiddleware, requireStaff, getDashboardSummaryHandler);
// GET /api/dashboard/payments/:id — staff only
router.get('/payments/:id', authMiddleware, requireStaff, getPendingPaymentDetailHandler);
export default router;
//# sourceMappingURL=dashboard.routes.js.map