import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { requireStaff } from '../middleware/requireStaff.middleware.js';
import { getCloudinarySignatureHandler } from '../controllers/uploads.controller.js';
import { deleteUploadedAssetHandler } from '../controllers/uploads.controller.js';

const router = Router();

// GET /api/uploads/cloudinary-signature — any authenticated user (distributor
// or staff). Distributors need this for KYC document uploads; staff need it
// for products/articles/news/training/events. Do NOT gate this behind
// requireStaff — that was blocking every distributor-side upload.
router.get('/cloudinary-signature', authMiddleware, getCloudinarySignatureHandler);

// POST /api/uploads/delete — staff only, used to clean up abandoned uploads
// in admin screens.
router.post('/delete', authMiddleware, requireStaff, deleteUploadedAssetHandler);

export default router;