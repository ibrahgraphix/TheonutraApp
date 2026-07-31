import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { ChangePasswordSchema, ChangePhoneNumberSchema, PaymentMethodSchema } from '../schemas/account.schema.js';
import {
  changePasswordHandler,
  changePhoneNumberHandler,
  deactivateOwnAccountHandler,
  getPaymentMethodHandler,
  updatePaymentMethodHandler,
} from '../controllers/account.controller.js';

const router = Router();

// Apply auth middleware to all account routes
router.use(authMiddleware);

// PATCH /account/password — change password
router.patch('/password', validate(ChangePasswordSchema), changePasswordHandler);

// PATCH /account/phone — change phone number
router.patch('/phone', validate(ChangePhoneNumberSchema), changePhoneNumberHandler);

// GET /account/payment-method — get payment method details
router.get('/payment-method', getPaymentMethodHandler);

// PATCH /account/payment-method — update payment method details
router.patch('/payment-method', validate(PaymentMethodSchema), updatePaymentMethodHandler);

// DELETE /account — deactivate own account
router.delete('/', deactivateOwnAccountHandler);

export default router;
