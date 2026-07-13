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
} from '../controllers/products.controller.js';

const router = Router();

// GET /api/products?countryId=<uuid> — any authenticated user
router.get('/', authMiddleware, listProductsByCountryHandler);

// GET /api/products/:id?countryId=<uuid> — any authenticated user
// (must be declared before /:id/deactivate to avoid route conflicts)
router.get('/:id', authMiddleware, getProductByIdHandler);

// POST /api/products — staff only
router.post('/', authMiddleware, requireStaff, validate(CreateProductSchema), createProductHandler);

// PATCH /api/products/:id — staff only
router.patch('/:id', authMiddleware, requireStaff, validate(UpdateProductSchema), updateProductHandler);

// PATCH /api/products/:id/deactivate — staff only
router.patch('/:id/deactivate', authMiddleware, requireStaff, deactivateProductHandler);

export default router;
