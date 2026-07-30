import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { requireStaff } from '../middleware/requireStaff.middleware.js';
import { getCompanyOverviewHandler, getCountryPerformanceHandler, getProductPerformanceHandler, } from '../controllers/analyticsAdmin.controller.js';
const router = Router();
router.get('/company-overview', authMiddleware, requireStaff, getCompanyOverviewHandler);
router.get('/country-performance', authMiddleware, requireStaff, getCountryPerformanceHandler);
router.get('/product-performance', authMiddleware, requireStaff, getProductPerformanceHandler);
export default router;
//# sourceMappingURL=analyticsAdmin.routes.js.map