import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { requireStaff } from '../middleware/requireStaff.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { CreateProductSchema, UpdateProductSchema } from '../schemas/catalog.schema.js';
import {
  listProductsByCountryHandler,
  getProductByIdHandler,
  createProductHandler,
  updateProductHandler,
  deactivateProductHandler,
  activateProductHandler,
  listProductsForAdminHandler,
  getProductForAdminHandler,
} from '../controllers/products.controller.js';

const router = Router();

router.get('/admin/list', authMiddleware, requireStaff, listProductsForAdminHandler);
router.get('/', authMiddleware, listProductsByCountryHandler);
router.get('/:id/admin', authMiddleware, requireStaff, getProductForAdminHandler);
router.get('/:id', authMiddleware, getProductByIdHandler);
router.post('/', authMiddleware, requireStaff, validate(CreateProductSchema), createProductHandler);
router.patch('/:id', authMiddleware, requireStaff, validate(UpdateProductSchema), updateProductHandler);
router.patch('/:id/deactivate', authMiddleware, requireStaff, deactivateProductHandler);
router.patch('/:id/activate', authMiddleware, requireStaff, activateProductHandler);

export default router;