import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { getMyLoyaltyHandler } from '../controllers/loyalty.controller.js';
const router = Router();
router.use(authMiddleware);
router.get('/me', getMyLoyaltyHandler);
export default router;
//# sourceMappingURL=loyalty.routes.js.map