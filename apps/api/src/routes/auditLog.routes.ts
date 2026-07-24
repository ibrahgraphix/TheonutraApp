import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { requireStaff } from '../middleware/requireStaff.middleware.js';
import { getAuditLogHandler } from '../controllers/auditLog.controller.js';

const router = Router();

// Base audit log routes for staff only
router.use(authMiddleware);

// GET /api/audit-log — list audit log entries with optional filters (staff only)
router.get('/', requireStaff, getAuditLogHandler);

export default router;
