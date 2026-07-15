import { Request, Response, NextFunction } from 'express';
import * as accountService from '../services/account.service.js';
import { ChangePasswordInput, ChangePhoneNumberInput } from '../schemas/account.schema.js';
import { ApiError } from '../middleware/error.middleware.js';

/**
 * PATCH /account/password
 * Changes the user's password after verifying the current password.
 */
export async function changePasswordHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) {
      throw new ApiError(401, 'Unauthorized');
    }

    const input = req.body as ChangePasswordInput;
    await accountService.changePassword(req.user.id, input.currentPassword, input.newPassword);
    res.status(200).json({ message: 'Password changed successfully' });
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /account/phone
 * Changes the user's phone number.
 */
export async function changePhoneNumberHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) {
      throw new ApiError(401, 'Unauthorized');
    }

    const input = req.body as ChangePhoneNumberInput;
    await accountService.changePhoneNumber(req.user.id, input.newPhoneNumber);
    res.status(200).json({ message: 'Phone number updated successfully' });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /account
 * Deactivates the user's own account (soft delete).
 */
export async function deactivateOwnAccountHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) {
      throw new ApiError(401, 'Unauthorized');
    }

    await accountService.deactivateOwnAccount(req.user.id);
    res.status(200).json({ message: 'Account deactivated successfully' });
  } catch (err) {
    next(err);
  }
}
