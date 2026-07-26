import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { requireStaff } from '../middleware/requireStaff.middleware.js';
import {
  listCategoriesHandler,
  createCategoryHandler,
  updateCategoryHandler,
  listMaterialsByCategoryHandler,
  getMaterialHandler,
  createMaterialHandler,
  updateMaterialHandler,
  deactivateMaterialHandler,
  hardDeleteMaterialHandler,
} from '../controllers/training.controller.js';

const router = Router();

// Public routes (no auth required for viewing)
router.get('/categories', listCategoriesHandler);
router.get('/categories/:id/materials', listMaterialsByCategoryHandler);
router.get('/materials/:id', getMaterialHandler);

// Authenticated routes
router.use(authMiddleware);

// Staff-only routes for creating/editing/deleting
router.post('/categories', requireStaff, createCategoryHandler);
router.put('/categories/:id', requireStaff, updateCategoryHandler);
router.post('/materials', requireStaff, createMaterialHandler);
router.put('/materials/:id', requireStaff, updateMaterialHandler);
router.delete('/materials/:id', requireStaff, deactivateMaterialHandler);
router.delete('/materials/:id/permanent', requireStaff, hardDeleteMaterialHandler);

export default router;