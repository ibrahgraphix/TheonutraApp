import { Router } from 'express';
import { requireStaff } from '../middleware/requireStaff.middleware.js';
import { getDirectRecruitsHandler, getMyTeamHandler, getTeamCountsHandler, } from '../controllers/team.controller.js';
const router = Router();
// All routes require authentication — applied at the app.use level in app.ts.
// GET /api/team — direct recruits only (level = 1), for the collapsed team view
router.get('/', getDirectRecruitsHandler);
// GET /api/team/full — full multi-level downline, flat list
// ⚠️  Must be declared before /:id patterns (none exist here, but good practice)
router.get('/full', getMyTeamHandler);
// GET /api/team/counts — staff-only bulk recruit counts (supplementary endpoint)
router.get('/counts', requireStaff, getTeamCountsHandler);
export default router;
//# sourceMappingURL=team.routes.js.map