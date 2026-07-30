import { Request, Response, NextFunction } from 'express';
import * as paymentsService from '../services/payments.service.js';
import { BankPaymentInput, MobileMoneyPaymentInput } from '../schemas/payments.schema.js';
import { ApiError } from '../middleware/error.middleware.js';

/**
 * POST /api/payments/bank
 * Submits bank payment.
 */
export async function submitBankPaymentHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) {
      throw new ApiError(401, 'Unauthorized');
    }

    const { orderId, referenceNo } = req.body as BankPaymentInput;
    const payment = await paymentsService.submitBankPayment(orderId, req.user.id, referenceNo);
    res.status(201).json(payment);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/payments/mobile-money
 * Submits mobile money payment.
 */
export async function submitMobileMoneyPaymentHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) {
      throw new ApiError(401, 'Unauthorized');
    }

    const { orderId, provider, phoneNumber } = req.body as MobileMoneyPaymentInput;
    const payment = await paymentsService.submitMobileMoneyPayment(orderId, req.user.id, provider, phoneNumber);
    res.status(201).json(payment);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/payments/pending
 * Lists pending payments. Staff only.
 */
export async function listPendingPaymentsHandler(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const payments = await paymentsService.listPendingPayments();
    res.status(200).json(payments);
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/payments/:id/confirm
 * Confirms payment. Staff only.
 */
export async function confirmPaymentHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) {
      throw new ApiError(401, 'Unauthorized');
    }

    const id = req.params['id'] as string;
    if (!id) {
      throw new ApiError(400, 'Payment ID is required');
    }

    await paymentsService.confirmPayment(id, req.user.id);
    res.status(200).json({ message: 'Payment confirmed and sale recorded successfully' });
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/payments/:id/reject
 * Rejects payment. Staff only.
 */
export async function rejectPaymentHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) {
      throw new ApiError(401, 'Unauthorized');
    }

    const id = req.params['id'] as string;
    if (!id) {
      throw new ApiError(400, 'Payment ID is required');
    }

    // Capture reason from body if any
    const reason = req.body['reason'] as string | undefined;

    await paymentsService.rejectPayment(id, req.user.id, reason);
    res.status(200).json({ message: 'Payment rejected and order cancelled successfully' });
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/payments/awaiting/:orderId/mark-paid
 * Manually marks a "Pay Later" order as paid. Staff only.
 */
export async function markOrderPaidManuallyHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) {
      throw new ApiError(401, 'Unauthorized');
    }

    const orderId = req.params['orderId'] as string;
    if (!orderId) {
      throw new ApiError(400, 'Order ID is required');
    }

    const { method, note } = req.body as { method?: 'cash' | 'bank_transfer' | 'mobile_money'; note?: string };

    await paymentsService.markOrderPaidManually(orderId, req.user.id, method, note);
    res.status(200).json({ message: 'Order marked as paid' });
  } catch (err) {
    next(err);
  }
}