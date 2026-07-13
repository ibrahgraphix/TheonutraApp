import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { requireStaff } from '../middleware/requireStaff.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { CreateCountrySchema, UpdateCountrySchema } from '../schemas/catalog.schema.js';
import {
  listCountriesHandler,
  createCountryHandler,
  updateCountryHandler,
} from '../controllers/countries.controller.js';

const router = Router();

// GET /api/countries — any authenticated user
router.get('/', authMiddleware, listCountriesHandler);

// POST /api/countries — staff only
router.post('/', authMiddleware, requireStaff, validate(CreateCountrySchema), createCountryHandler);

// PATCH /api/countries/:id — staff only
router.patch('/:id', authMiddleware, requireStaff, validate(UpdateCountrySchema), updateCountryHandler);

export default router;
