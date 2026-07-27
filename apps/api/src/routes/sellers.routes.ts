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
  activateSellerHandler,
  hardDeleteSellerHandler,
} from '../controllers/sellers.controller.js';

const router = Router();

router.post('/', validate(CreateSellerSchema), createSellerHandler);
router.get('/', listSellersHandler);
router.get('/:id', getSellerByIdHandler);
router.patch('/:id', updateSellerHandler);
router.patch('/:id/reset-password', validate(ResetPasswordSchema), resetSellerPasswordHandler);
router.patch('/:id/deactivate', deactivateSellerHandler);
router.patch('/:id/activate', activateSellerHandler);
router.delete('/:id', hardDeleteSellerHandler);

export default router;