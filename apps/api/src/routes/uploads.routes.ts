import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { requireStaff } from '../middleware/requireStaff.middleware.js';
import { getCloudinarySignatureHandler } from '../controllers/uploads.controller.js';

const router = Router();

// GET /api/uploads/cloudinary-signature — auth + staff only
router.get('/cloudinary-signature', authMiddleware, requireStaff, getCloudinarySignatureHandler);

export default router;
