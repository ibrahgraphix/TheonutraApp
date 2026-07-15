import { Router } from 'express';
import { validate } from '../middleware/validate.middleware.js';
import { CreateSellerSchema, ResetPasswordSchema } from '../schemas/sellers.schema.js';
import { createSellerHandler, listSellersHandler, getSellerByIdHandler, resetSellerPasswordHandler, deactivateSellerHandler, } from '../controllers/sellers.controller.js';
const router = Router();
// POST /api/sellers - Add a new seller (staff only)
router.post('/', validate(CreateSellerSchema), createSellerHandler);
// GET /api/sellers - List/search sellers (staff only)
router.get('/', listSellersHandler);
// GET /api/sellers/:id - Get seller by ID (staff only)
router.get('/:id', getSellerByIdHandler);
// PATCH /api/sellers/:id/reset-password - Reset seller password (staff only)
router.patch('/:id/reset-password', validate(ResetPasswordSchema), resetSellerPasswordHandler);
// PATCH /api/sellers/:id/deactivate - Deactivate seller (staff only)
router.patch('/:id/deactivate', deactivateSellerHandler);
export default router;
//# sourceMappingURL=sellers.routes.js.map