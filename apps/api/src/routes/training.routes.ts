import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { requireStaff } from '../middleware/requireStaff.middleware.js';
import {
  listCategoriesHandler,
  createCategoryHandler,
  updateCategoryHandler,
  deleteCategoryHandler,
  listMaterialsByCategoryHandler,
  getMaterialHandler,
  createMaterialHandler,
  updateMaterialHandler,
  deactivateMaterialHandler,
  hardDeleteMaterialHandler,
} from '../controllers/training.controller.js';

const router = Router();

router.get('/categories', listCategoriesHandler);
router.get('/categories/:id/materials', listMaterialsByCategoryHandler);
router.get('/materials/:id', getMaterialHandler);

router.use(authMiddleware);

router.post('/categories', requireStaff, createCategoryHandler);
router.put('/categories/:id', requireStaff, updateCategoryHandler);
router.delete('/categories/:id', requireStaff, deleteCategoryHandler);
router.post('/materials', requireStaff, createMaterialHandler);
router.put('/materials/:id', requireStaff, updateMaterialHandler);
router.delete('/materials/:id', requireStaff, deactivateMaterialHandler);
router.delete('/materials/:id/permanent', requireStaff, hardDeleteMaterialHandler);

export default router;