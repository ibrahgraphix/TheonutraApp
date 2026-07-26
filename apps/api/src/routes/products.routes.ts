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
  listProductsForAdminHandler,
  getProductForAdminHandler,
} from '../controllers/products.controller.js';

const router = Router();

// GET /api/products/admin/list — staff only, ALL products + ALL price rows
// Must be declared BEFORE /:id and /:id/admin to avoid /:id swallowing "admin"
router.get('/admin/list', authMiddleware, requireStaff, listProductsForAdminHandler);

// GET /api/products?countryId=<uuid> — any authenticated user
router.get('/', authMiddleware, listProductsByCountryHandler);

// GET /api/products/:id/admin — staff only, single product + ALL price rows
router.get('/:id/admin', authMiddleware, requireStaff, getProductForAdminHandler);

// GET /api/products/:id?countryId=<uuid> — any authenticated user
router.get('/:id', authMiddleware, getProductByIdHandler);

// POST /api/products — staff only
router.post('/', authMiddleware, requireStaff, validate(CreateProductSchema), createProductHandler);

// PATCH /api/products/:id — staff only
router.patch('/:id', authMiddleware, requireStaff, validate(UpdateProductSchema), updateProductHandler);

// PATCH /api/products/:id/deactivate — staff only
router.patch('/:id/deactivate', authMiddleware, requireStaff, deactivateProductHandler);

export default router;