import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { requireStaff } from '../middleware/requireStaff.middleware.js';
import { getAuditLogsHandler } from '../controllers/auditLog.controller.js';
const router = Router();
router.use(authMiddleware);
router.get('/', requireStaff, getAuditLogsHandler);
export default router;
//# sourceMappingURL=auditLog.routes.js.map