import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { requireStaff } from '../middleware/requireStaff.middleware.js';
import { listActiveStatusRanksHandler, listLeadershipRanksHandler, getMyCompensationSnapshotHandler, runMonthlyRequalificationHandler, listPendingOPBBonusesHandler, approveOPBBonusHandler, rejectOPBBonusHandler, } from '../controllers/compensationPlan.controller.js';
const router = Router();
router.get('/active-status-ranks', authMiddleware, listActiveStatusRanksHandler);
router.get('/leadership-ranks', authMiddleware, listLeadershipRanksHandler);
router.get('/me', authMiddleware, getMyCompensationSnapshotHandler);
router.post('/run-monthly', authMiddleware, requireStaff, runMonthlyRequalificationHandler);
router.get('/opb/pending', authMiddleware, requireStaff, listPendingOPBBonusesHandler);
router.patch('/opb/:id/approve', authMiddleware, requireStaff, approveOPBBonusHandler);
router.patch('/opb/:id/reject', authMiddleware, requireStaff, rejectOPBBonusHandler);
export default router;
//# sourceMappingURL=compensationPlan.routes.js.map