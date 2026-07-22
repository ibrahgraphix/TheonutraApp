import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { requireStaff } from '../middleware/requireStaff.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { PromoteDistributorSchema } from '../schemas/ranks.schema.js';
import {
  getRanks,
  getMyRankProgress,
  promoteDistributorHandler,
} from '../controllers/ranks.controller.js';

const router = Router();

// GET /api/ranks - ladder (authenticated only)
router.get('/', authMiddleware, getRanks);

// GET /api/ranks/me - current user rank progress (authenticated only)
router.get('/me', authMiddleware, getMyRankProgress);

// PATCH /api/ranks/:distributorId/promote - promote a distributor (staff only)
router.patch(
  '/:distributorId/promote',
  authMiddleware,
  requireStaff,
  validate(PromoteDistributorSchema),
  promoteDistributorHandler,
);

export default router;
