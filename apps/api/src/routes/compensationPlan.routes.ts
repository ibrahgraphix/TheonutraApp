import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { requireStaff } from '../middleware/requireStaff.middleware.js';
import {
  listActiveStatusRanksHandler,
  listLeadershipRanksHandler,
  runDailyUpdateHandler,
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
import {
  listStarRanksHandler,
  getMyV1SnapshotHandler,
  runMonthlyV1JobHandler,
  listPendingNetworkBonusesHandler,
  approveNetworkBonusHandler,
  rejectNetworkBonusHandler,
  runPayoutBatchHandler,
} from '../controllers/compensationEngine.controller.js';

const router = Router();

// THEONUTRA V1
router.get('/star-ranks', authMiddleware, listStarRanksHandler);
router.get('/v1/me', authMiddleware, getMyV1SnapshotHandler);
router.post('/v1/run-monthly', authMiddleware, requireStaff, runMonthlyV1JobHandler);
router.get('/v1/bonuses/pending', authMiddleware, requireStaff, listPendingNetworkBonusesHandler);
router.patch('/v1/bonuses/:id/approve', authMiddleware, requireStaff, approveNetworkBonusHandler);
router.patch('/v1/bonuses/:id/reject', authMiddleware, requireStaff, rejectNetworkBonusHandler);
router.post('/v1/run-payout-batch', authMiddleware, requireStaff, runPayoutBatchHandler);

// /me returns V1 snapshot
router.get('/active-status-ranks', authMiddleware, listActiveStatusRanksHandler);
router.get('/leadership-ranks', authMiddleware, listLeadershipRanksHandler);
router.get('/me', authMiddleware, getMyV1SnapshotHandler);
router.post('/run-daily', authMiddleware, requireStaff, runDailyUpdateHandler);
router.post('/run-monthly', authMiddleware, requireStaff, runMonthlyV1JobHandler);

router.get('/opb/pending', authMiddleware, requireStaff, listPendingOPBBonusesHandler);
router.patch('/opb/:id/approve', authMiddleware, requireStaff, approveOPBBonusHandler);
router.patch('/opb/:id/reject', authMiddleware, requireStaff, rejectOPBBonusHandler);

router.get('/commissions/pending', authMiddleware, requireStaff, listPendingCommissionsHandler);
router.patch('/commissions/:id/approve', authMiddleware, requireStaff, approveCommissionHandler);
router.patch('/commissions/:id/reject', authMiddleware, requireStaff, rejectCommissionHandler);

router.get('/leadership/pending', authMiddleware, requireStaff, listPendingLeadershipBonusesHandler);
router.patch('/leadership/:id/approve', authMiddleware, requireStaff, approveLeadershipBonusHandler);
router.patch('/leadership/:id/reject', authMiddleware, requireStaff, rejectLeadershipBonusHandler);

router.get('/rank/pending', authMiddleware, requireStaff, listPendingRankBonusesHandler);
router.patch('/rank/:id/approve', authMiddleware, requireStaff, approveRankBonusHandler);
router.patch('/rank/:id/reject', authMiddleware, requireStaff, rejectRankBonusHandler);

export default router;
