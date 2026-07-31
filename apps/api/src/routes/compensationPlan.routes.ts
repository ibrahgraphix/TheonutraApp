import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { requireStaff } from '../middleware/requireStaff.middleware.js';
import {
  listActiveStatusRanksHandler,
  listLeadershipRanksHandler,
  getMyCompensationSnapshotHandler,
  runMonthlyRequalificationHandler,
  listPendingOPBBonusesHandler,
  approveOPBBonusHandler,
  rejectOPBBonusHandler,
  listPendingCommissionsHandler,
  approveCommissionHandler,
  rejectCommissionHandler,
  listPendingLeadershipBonusesHandler,
  approveLeadershipBonusHandler,
  rejectLeadershipBonusHandler,
  listPendingRankBonusesHandler,
  approveRankBonusHandler,
  rejectRankBonusHandler,
} from '../controllers/compensationPlan.controller.js';

const router = Router();

router.get('/active-status-ranks', authMiddleware, listActiveStatusRanksHandler);
router.get('/leadership-ranks', authMiddleware, listLeadershipRanksHandler);
router.get('/me', authMiddleware, getMyCompensationSnapshotHandler);
router.post('/run-monthly', authMiddleware, requireStaff, runMonthlyRequalificationHandler);
router.get('/opb/pending', authMiddleware, requireStaff, listPendingOPBBonusesHandler);
router.patch('/opb/:id/approve', authMiddleware, requireStaff, approveOPBBonusHandler);
router.patch('/opb/:id/reject', authMiddleware, requireStaff, rejectOPBBonusHandler);

// Pending commissions (referral, team bonus) routes
router.get('/commissions/pending', authMiddleware, requireStaff, listPendingCommissionsHandler);
router.patch('/commissions/:id/approve', authMiddleware, requireStaff, approveCommissionHandler);
router.patch('/commissions/:id/reject', authMiddleware, requireStaff, rejectCommissionHandler);

// Pending leadership bonuses routes
router.get('/leadership/pending', authMiddleware, requireStaff, listPendingLeadershipBonusesHandler);
router.patch('/leadership/:id/approve', authMiddleware, requireStaff, approveLeadershipBonusHandler);
router.patch('/leadership/:id/reject', authMiddleware, requireStaff, rejectLeadershipBonusHandler);

// Pending rank bonuses routes
router.get('/rank/pending', authMiddleware, requireStaff, listPendingRankBonusesHandler);
router.patch('/rank/:id/approve', authMiddleware, requireStaff, approveRankBonusHandler);
router.patch('/rank/:id/reject', authMiddleware, requireStaff, rejectRankBonusHandler);

export default router;