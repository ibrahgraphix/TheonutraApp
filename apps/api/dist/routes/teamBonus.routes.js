import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { requireStaff } from '../middleware/requireStaff.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { RunTeamBonusSchema, CreateTeamBonusRateSchema } from '../schemas/teamBonus.schema.js';
import { getMyTeamBonusSummaryHandler, getTeamBonusHistoryHandler, runTeamBonusBatchHandler, getTeamBonusRatesHandler, updateTeamBonusRatesHandler, } from '../controllers/teamBonus.controller.js';
const router = Router();
// GET /api/team-bonus/my-summary?period=YYYY-MM — authenticated distributor
router.get('/my-summary', authMiddleware, getMyTeamBonusSummaryHandler);
// GET /api/team-bonus/history?page=1&limit=20 — authenticated distributor
router.get('/history', authMiddleware, getTeamBonusHistoryHandler);
// POST /api/team-bonus/run — staff only (batch job)
router.post('/run', authMiddleware, requireStaff, validate(RunTeamBonusSchema), runTeamBonusBatchHandler);
// GET /api/team-bonus/rates — staff only
router.get('/rates', authMiddleware, requireStaff, getTeamBonusRatesHandler);
// PUT /api/team-bonus/rates — staff only
router.put('/rates', authMiddleware, requireStaff, validate(CreateTeamBonusRateSchema), updateTeamBonusRatesHandler);
export default router;
//# sourceMappingURL=teamBonus.routes.js.map