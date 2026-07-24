import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { requireStaff } from '../middleware/requireStaff.middleware.js';
import {
  getMyReferralInfoHandler,
  validateReferralCodeHandler,
  regenerateReferralCodeHandler,
} from '../controllers/referral.controller.js';

const router = Router();

// GET /api/referral/validate/:code — public, used pre-signup
router.get('/validate/:code', validateReferralCodeHandler);

// Authenticated routes
router.use(authMiddleware);

// GET /api/referral/me — get my referral code and shareable link
router.get('/me', getMyReferralInfoHandler);

// Staff-only routes
// PUT /api/referral/:distributorId/regenerate — regenerate referral code
router.put('/:distributorId/regenerate', requireStaff, regenerateReferralCodeHandler);

export default router;
