import { Router } from 'express';
import { requireStaff } from '../middleware/requireStaff.middleware.js';
import { getDirectRecruitsHandler, getMyTeamHandler, getTeamCountsHandler, getTeamForDistributorHandler, } from '../controllers/team.controller.js';
const router = Router();
// All routes require authentication — applied at the app.use level in app.ts.
// GET /api/team — direct recruits only (level = 1), for the collapsed team view
router.get('/', getDirectRecruitsHandler);
// GET /api/team/full — full multi-level downline, flat list
// ⚠️  Must be declared before /:id patterns.
router.get('/full', getMyTeamHandler);
// GET /api/team/counts — staff-only bulk recruit counts (supplementary endpoint)
// ⚠️  Must be declared before /:id — otherwise Express would treat "counts"
//     as a distributor id and route it into getTeamForDistributorHandler.
router.get('/counts', requireStaff, getTeamCountsHandler);
// GET /api/team/:id — staff-only: view ANY distributor's full downline.
// Declared LAST so it never shadows the literal routes above.
router.get('/:id', requireStaff, getTeamForDistributorHandler);
export default router;
//# sourceMappingURL=team.routes.js.map