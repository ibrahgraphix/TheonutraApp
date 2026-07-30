import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { requireStaff } from '../middleware/requireStaff.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { CreateOrderSchema } from '../schemas/orders.schema.js';
import { createOrderHandler, getOrderByIdHandler, listMyOrdersHandler, listAwaitingPaymentOrdersHandler, } from '../controllers/orders.controller.js';
const router = Router();
// Apply auth middleware to all order routes
router.use(authMiddleware);
// GET /api/orders/awaiting-payment — staff only
// Must be declared BEFORE /:id to avoid /:id swallowing "awaiting-payment"
router.get('/awaiting-payment', requireStaff, listAwaitingPaymentOrdersHandler);
// POST /api/orders — place order
router.post('/', validate(CreateOrderSchema), createOrderHandler);
// GET /api/orders/:id — get order detail
router.get('/:id', getOrderByIdHandler);
// GET /api/orders — list my orders
router.get('/', listMyOrdersHandler);
export default router;
//# sourceMappingURL=orders.routes.js.map