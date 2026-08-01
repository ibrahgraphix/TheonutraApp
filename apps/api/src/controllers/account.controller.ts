import { Request, Response, NextFunction } from 'express';
import * as accountService from '../services/account.service.js';
import { ChangePasswordInput, ChangePhoneNumberInput, PaymentMethodInput } from '../schemas/account.schema.js';
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

/**
 * GET /account/payment-method
 * Returns the user's payment method details.
 */
export async function getPaymentMethodHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) {
      throw new ApiError(401, 'Unauthorized');
    }

    const paymentMethod = await accountService.getPaymentMethod(req.user.id);
    res.status(200).json(paymentMethod);
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /account/payment-method
 * Submits a payment method change request (pending admin confirmation).
 */
export async function updatePaymentMethodHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) {
      throw new ApiError(401, 'Unauthorized');
    }

    const input = req.body as PaymentMethodInput;
    const result = await accountService.requestPaymentMethodChange(
      req.user.id,
      input.payment_method,
      input.payment_full_name,
      input.payment_account_number,
    );
    res.status(202).json({
      message: 'Payment method change submitted — pending admin confirmation',
      requestId: result.requestId,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /account/payment-method/pending-changes — staff
 */
export async function listPaymentMethodChangesHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    res.status(200).json(await accountService.listPendingPaymentMethodChanges());
  } catch (err) {
    next(err);
  }
}

export async function approvePaymentMethodChangeHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) throw new ApiError(401, 'Unauthorized');
    const id = req.params['id'] as string;
    await accountService.approvePaymentMethodChange(id, req.user.id);
    res.status(200).json({ message: 'Payment method change approved' });
  } catch (err) {
    next(err);
  }
}

export async function rejectPaymentMethodChangeHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) throw new ApiError(401, 'Unauthorized');
    const id = req.params['id'] as string;
    const notes = (req.body?.notes as string) || undefined;
    await accountService.rejectPaymentMethodChange(id, req.user.id, notes);
    res.status(200).json({ message: 'Payment method change rejected' });
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /account/photo
 * Sets passport/photo URL after Cloudinary upload.
 */
export async function updatePhotoHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) throw new ApiError(401, 'Unauthorized');
    const photoUrl = req.body?.photoUrl as string;
    if (!photoUrl) throw new ApiError(400, 'photoUrl is required');
    const result = await accountService.updatePhotoUrl(req.user.id, photoUrl);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}
