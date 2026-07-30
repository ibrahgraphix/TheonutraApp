import { Request, Response, NextFunction } from 'express';
import * as walletService from '../services/wallet.service.js';
import { RequestWithdrawalInput } from '../schemas/wallet.schema.js';
import { ApiError } from '../middleware/error.middleware.js';

/**
 * GET /api/wallet/me
 * Returns wallet details (balance + recent 10 transactions) for the authenticated user.
 */
export async function getMyWalletHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) {
      throw new ApiError(401, 'Unauthorized');
    }
    const wallet = await walletService.getMyWallet(req.user.id);
    res.status(200).json(wallet);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/wallet/transactions
 * Returns paginated wallet transactions for the authenticated user.
 */
export async function getMyTransactionsHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) {
      throw new ApiError(401, 'Unauthorized');
    }
    const page = parseInt(req.query['page'] as string, 10) || 1;
    const limit = parseInt(req.query['limit'] as string, 10) || 20;

    const result = await walletService.getMyTransactions(req.user.id, page, limit);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/wallet/withdrawals
 * Submits a new withdrawal request for the authenticated user.
 */
export async function requestWithdrawalHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) {
      throw new ApiError(401, 'Unauthorized');
    }
    const input = req.body as RequestWithdrawalInput;
    const requestId = await walletService.requestWithdrawal(
      req.user.id,
      input.amount,
      input.method,
      input.payoutDetails,
    );
    res.status(201).json({ id: requestId, message: 'Withdrawal request submitted successfully' });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/wallet/withdrawals
 * Returns the authenticated user's withdrawal request history.
 */
export async function getMyWithdrawalsHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) {
      throw new ApiError(401, 'Unauthorized');
    }
    const withdrawals = await walletService.getMyWithdrawals(req.user.id);
    res.status(200).json(withdrawals);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/wallet/withdrawals/all
 * Returns all withdrawal requests. Filterable by status. Staff only.
 */
export async function getAllWithdrawalsHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const status = req.query['status'] as string | undefined;
    const withdrawals = await walletService.getAllWithdrawals(status);
    res.status(200).json(withdrawals);
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/wallet/withdrawals/:id/approve
 * Approves a pending withdrawal request. Staff only.
 */
export async function approveWithdrawalHandler(
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
      throw new ApiError(400, 'Withdrawal ID is required');
    }
    await walletService.approveWithdrawal(id, req.user.id);
    res.status(200).json({ message: 'Withdrawal request approved successfully' });
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/wallet/withdrawals/:id/reject
 * Rejects a pending withdrawal request. Staff only.
 */
export async function rejectWithdrawalHandler(
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
      throw new ApiError(400, 'Withdrawal ID is required');
    }
    const notes = (req.body?.notes as string) || '';
    await walletService.rejectWithdrawal(id, req.user.id, notes);
    res.status(200).json({ message: 'Withdrawal request rejected successfully' });
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/wallet/withdrawals/:id/mark-paid
 * Marks an approved withdrawal request as paid. Staff only.
 */
export async function markWithdrawalPaidHandler(
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
      throw new ApiError(400, 'Withdrawal ID is required');
    }
    await walletService.markWithdrawalPaid(id, req.user.id);
    res.status(200).json({ message: 'Withdrawal request marked as paid' });
  } catch (err) {
    next(err);
  }
}
