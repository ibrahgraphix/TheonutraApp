import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { requireStaff } from '../middleware/requireStaff.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { ChangePasswordSchema, ChangePhoneNumberSchema, PaymentMethodSchema } from '../schemas/account.schema.js';
import {
  changePasswordHandler,
  changePhoneNumberHandler,
  deactivateOwnAccountHandler,
  getPaymentMethodHandler,
  updatePaymentMethodHandler,
  listPaymentMethodChangesHandler,
  approvePaymentMethodChangeHandler,
  rejectPaymentMethodChangeHandler,
  updatePhotoHandler,
} from '../controllers/account.controller.js';

const router = Router();

router.use(authMiddleware);

router.patch('/password', validate(ChangePasswordSchema), changePasswordHandler);
router.patch('/phone', validate(ChangePhoneNumberSchema), changePhoneNumberHandler);

router.get('/payment-method', getPaymentMethodHandler);
router.patch('/payment-method', validate(PaymentMethodSchema), updatePaymentMethodHandler);

router.get('/payment-method/pending-changes', requireStaff, listPaymentMethodChangesHandler);
router.patch('/payment-method/changes/:id/approve', requireStaff, approvePaymentMethodChangeHandler);
router.patch('/payment-method/changes/:id/reject', requireStaff, rejectPaymentMethodChangeHandler);

router.patch('/photo', updatePhotoHandler);

router.delete('/', deactivateOwnAccountHandler);

export default router;
