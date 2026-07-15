import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { requireStaff } from '../middleware/requireStaff.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { BankPaymentSchema, MobileMoneyPaymentSchema } from '../schemas/payments.schema.js';
import { submitBankPaymentHandler, submitMobileMoneyPaymentHandler, listPendingPaymentsHandler, confirmPaymentHandler, rejectPaymentHandler, } from '../controllers/payments.controller.js';
const router = Router();
// Apply auth middleware to all payments routes
router.use(authMiddleware);
// POST /api/payments/bank — submit bank payment slip
router.post('/bank', validate(BankPaymentSchema), submitBankPaymentHandler);
// POST /api/payments/mobile-money — submit mobile money reference
router.post('/mobile-money', validate(MobileMoneyPaymentSchema), submitMobileMoneyPaymentHandler);
// GET /api/payments/pending — list pending payments (staff only)
router.get('/pending', requireStaff, listPendingPaymentsHandler);
// PATCH /api/payments/:id/confirm — confirm payment (staff only)
router.patch('/:id/confirm', requireStaff, confirmPaymentHandler);
// PATCH /api/payments/:id/reject — reject payment (staff only)
router.patch('/:id/reject', requireStaff, rejectPaymentHandler);
export default router;
//# sourceMappingURL=payments.routes.js.map