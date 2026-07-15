import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { ChangePasswordSchema, ChangePhoneNumberSchema } from '../schemas/account.schema.js';
import {
  changePasswordHandler,
  changePhoneNumberHandler,
  deactivateOwnAccountHandler,
} from '../controllers/account.controller.js';

const router = Router();

// Apply auth middleware to all account routes
router.use(authMiddleware);

// PATCH /account/password — change password
router.patch('/password', validate(ChangePasswordSchema), changePasswordHandler);

// PATCH /account/phone — change phone number
router.patch('/phone', validate(ChangePhoneNumberSchema), changePhoneNumberHandler);

// DELETE /account — deactivate own account
router.delete('/', deactivateOwnAccountHandler);

export default router;
