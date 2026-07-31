import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { LogCustomerSaleSchema } from '../schemas/customerSales.schema.js';
import {
  logCustomerSaleHandler,
  listMyCustomerSalesHandler,
  getMyCustomerSalesSummaryHandler,
  getRetailProfitReportHandler,
} from '../controllers/customerSales.controller.js';

const router = Router();

// POST /api/customer-sales — authenticated distributor
router.post('/', authMiddleware, validate(LogCustomerSaleSchema), logCustomerSaleHandler);

// GET /api/customer-sales?page=1&limit=20 — authenticated distributor
router.get('/', authMiddleware, listMyCustomerSalesHandler);

// GET /api/customer-sales/summary?month=2024-01 — authenticated distributor
router.get('/summary', authMiddleware, getMyCustomerSalesSummaryHandler);

// GET /api/customer-sales/retail-profit-report?month=2024-01 — authenticated distributor
router.get('/retail-profit-report', authMiddleware, getRetailProfitReportHandler);

export default router;
