import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { requireStaff } from '../middleware/requireStaff.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { AwardManualBonusSchema } from '../schemas/manualBonus.schema.js';
import { awardBonusHandler, listAllBonusesHandler, getMyBonusesHandler, } from '../controllers/manualBonus.controller.js';
const router = Router();
// Base route authentication for all manual bonus endpoints
router.use(authMiddleware);
// GET /api/manual-bonuses/mine — distributor gets their own history
router.get('/mine', getMyBonusesHandler);
// Staff-only endpoints
// POST /api/manual-bonuses — award manual bonus
router.post('/', requireStaff, validate(AwardManualBonusSchema), awardBonusHandler);
// GET /api/manual-bonuses — list all with filters
router.get('/', requireStaff, listAllBonusesHandler);
export default router;
//# sourceMappingURL=manualBonus.routes.js.map