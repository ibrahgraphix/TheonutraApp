import { Router } from 'express';
import { validate } from '../middleware/validate.middleware.js';
import { CreateSellerSchema, ResetPasswordSchema } from '../schemas/sellers.schema.js';
import {
  createSellerHandler,
  listSellersHandler,
  getSellerByIdHandler,
  updateSellerHandler,
  resetSellerPasswordHandler,
  deactivateSellerHandler,
  hardDeleteSellerHandler,
} from '../controllers/sellers.controller.js';

const router = Router();

// POST /api/sellers - Add a new seller (staff only)
router.post('/', validate(CreateSellerSchema), createSellerHandler);

// GET /api/sellers - List/search sellers (staff only)
router.get('/', listSellersHandler);

// GET /api/sellers/:id - Get seller by ID (staff only)
router.get('/:id', getSellerByIdHandler);

// PATCH /api/sellers/:id - Edit name/phone/country (staff only)
router.patch('/:id', updateSellerHandler);

// PATCH /api/sellers/:id/reset-password - Reset seller password (staff only)
router.patch('/:id/reset-password', validate(ResetPasswordSchema), resetSellerPasswordHandler);

// PATCH /api/sellers/:id/deactivate - Deactivate seller (staff only)
router.patch('/:id/deactivate', deactivateSellerHandler);

// DELETE /api/sellers/:id - Permanently delete a seller with zero history
// (staff only). Rejected with 409 if the seller has any downline, orders,
// commissions, or customer sales — deactivate instead in that case.
router.delete('/:id', hardDeleteSellerHandler);

export default router;