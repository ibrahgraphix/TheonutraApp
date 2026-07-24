import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { getMyLoyaltyHandler } from '../controllers/loyalty.controller.js';

const router = Router();

// Base loyalty routes for authenticated users
router.use(authMiddleware);

// GET /api/loyalty/me — my balance + transaction history
router.get('/me', getMyLoyaltyHandler);

export default router;
