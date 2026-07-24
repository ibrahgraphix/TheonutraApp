import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { requireStaff } from '../middleware/requireStaff.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { SubmitKycSchema, ReviewKycSchema } from '../schemas/kyc.schema.js';
import { submitKycHandler, getMyKycHandler, listPendingKycHandler, getKycSubmissionHandler, reviewKycHandler, } from '../controllers/kyc.controller.js';
const router = Router();
// Base KYC routes for authenticated users
router.use(authMiddleware);
// POST /api/kyc/submit — submit KYC documents
router.post('/submit', validate(SubmitKycSchema), submitKycHandler);
// GET /api/kyc/me — get my KYC status and latest submission
router.get('/me', getMyKycHandler);
// Staff-only routes
// GET /api/kyc/pending — list all pending KYC submissions
router.get('/pending', requireStaff, listPendingKycHandler);
// GET /api/kyc/:id — get specific KYC submission
router.get('/:id', requireStaff, getKycSubmissionHandler);
// PUT /api/kyc/:id/review — review KYC submission
router.put('/:id/review', requireStaff, validate(ReviewKycSchema), reviewKycHandler);
export default router;
//# sourceMappingURL=kyc.routes.js.map