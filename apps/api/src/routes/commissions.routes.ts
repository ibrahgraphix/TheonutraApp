import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware.js';
import {
  getMyCommissionsHandler,
  getCommissionsSummaryHandler,
} from '../controllers/commissions.controller.js';

const router = Router();

// Apply auth middleware to all commission routes
router.use(authMiddleware);

// GET /api/commissions — list my commissions
router.get('/', getMyCommissionsHandler);

// GET /api/commissions/summary — get commission summary for a month
router.get('/summary', getCommissionsSummaryHandler);

export default router;
