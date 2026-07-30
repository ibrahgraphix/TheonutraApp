import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { requireAdmin } from '../middleware/requireAdmin.middleware.js';
import { requireStaff } from '../middleware/requireStaff.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { CreateCountrySchema, UpdateCountrySchema } from '../schemas/catalog.schema.js';
import { listCountriesHandler, listCountriesForAdminHandler, createCountryHandler, updateCountryHandler, deactivateCountryHandler, activateCountryHandler, } from '../controllers/countries.controller.js';
const router = Router();
// Must come before any wildcard-ish routes — but there are none here, order is safe.
router.get('/admin/list', authMiddleware, requireStaff, listCountriesForAdminHandler);
router.get('/', authMiddleware, listCountriesHandler);
router.post('/', authMiddleware, requireAdmin, validate(CreateCountrySchema), createCountryHandler);
router.patch('/:id', authMiddleware, requireStaff, validate(UpdateCountrySchema), updateCountryHandler);
router.patch('/:id/deactivate', authMiddleware, requireStaff, deactivateCountryHandler);
router.patch('/:id/activate', authMiddleware, requireStaff, activateCountryHandler);
export default router;
//# sourceMappingURL=countries.routes.js.map