//wallet.services
import { supabase } from '../config/supabase.js';
import { ApiError } from '../middleware/error.middleware.js';
import * as notificationService from './notification.service.js';
import * as auditLogService from './auditLog.service.js';

export interface Wallet {
  distributor_id: string;
  balance: number;
  updated_at: string;
}

export interface WalletTransaction {
  id: string;
  distributor_id: string;
  type: 'credit' | 'debit';
  source_type: 'commission' | 'team_bonus' | 'withdrawal' | 'manual_adjustment';
  source_id: string | null;
  amount: number;
  balance_after: number;
  created_at: string;
}

export interface WithdrawalRequest {
  id: string;
  distributor_id: string;
  amount: number;
  method: 'bank' | 'mobile_money';
  payout_details: string;
  status: 'pending' | 'approved' | 'rejected' | 'paid';
  requested_at: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  notes: string | null;
  profiles?: {
    full_name: string;
    distributor_id: string;
  };
}

/**
 * Ensures a wallet exists for a distributor, then returns the wallet and recent transactions.
 */
export async function getMyWallet(distributorId: string): Promise<{ balance: number; recentTransactions: WalletTransaction[] }> {
  // Ensure wallet exists by trying to insert a zero-balance wallet
  const { error: insertError } = await supabase
    .from('wallets')
    .insert({ distributor_id: distributorId, balance: 0.00 });

  if (insertError && insertError.code !== '23505') { // Ignore unique key violation
    throw new ApiError(500, `Failed to ensure wallet: ${insertError.message}`);
  }

  // Fetch the wallet
  const { data: wallet, error: walletError } = await supabase
    .from('wallets')
    .select('balance')
    .eq('distributor_id', distributorId)
    .single();

  if (walletError || !wallet) {
    throw new ApiError(500, `Failed to fetch wallet: ${walletError?.message}`);
  }

  // Fetch recent transactions (top 10)
  const { data: transactions, error: txError } = await supabase
    .from('wallet_transactions')
    .select('*')
    .eq('distributor_id', distributorId)
    .order('created_at', { ascending: false })
    .limit(10);

  if (txError) {
    throw new ApiError(500, `Failed to fetch recent transactions: ${txError.message}`);
  }

  return {
    balance: Number(wallet.balance),
    recentTransactions: (transactions ?? []).map(tx => ({
      ...tx,
      amount: Number(tx.amount),
      balance_after: Number(tx.balance_after),
    })),
  };
}

/**
 * Returns paginated transactions for a distributor.
 */
export async function getMyTransactions(
  distributorId: string,
  page: number = 1,
  limit: number = 20,
): Promise<{ transactions: WalletTransaction[]; total: number; page: number; limit: number }> {
  const offset = (page - 1) * limit;

  // Get total count
  const { count, error: countError } = await supabase
    .from('wallet_transactions')
    .select('*', { count: 'exact', head: true })
    .eq('distributor_id', distributorId);

  if (countError) {
    throw new ApiError(500, `Failed to count transactions: ${countError.message}`);
  }

  // Get paginated transactions
  const { data, error } = await supabase
    .from('wallet_transactions')
    .select('*')
    .eq('distributor_id', distributorId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    throw new ApiError(500, `Failed to fetch transactions: ${error.message}`);
  }

  return {
    transactions: (data ?? []).map(tx => ({
      ...tx,
      amount: Number(tx.amount),
      balance_after: Number(tx.balance_after),
    })),
    total: count ?? 0,
    page,
    limit,
  };
}

/**
 * Submits a withdrawal request. Invokes database RPC function to atomically
 * check available balance and reserve the amount.
 * Requires KYC to be approved before allowing withdrawal.
 */
export async function requestWithdrawal(
  distributorId: string,
  amount: number,
  method: 'bank' | 'mobile_money',
  payoutDetails: string,
): Promise<string> {
  // Check KYC status before allowing withdrawal
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('kyc_status')
    .eq('id', distributorId)
    .single();

  if (profileError || !profile) {
    throw new ApiError(404, 'Profile not found');
  }

  if (profile.kyc_status !== 'approved') {
    throw new ApiError(403, 'KYC must be approved before requesting a withdrawal');
  }

  const { data, error } = await supabase.rpc('create_withdrawal_request', {
    p_distributor_id: distributorId,
    p_amount: amount,
    p_method: method,
    p_payout_details: payoutDetails,
  });

  if (error) {
    // Check if error is due to insufficient balance
    if (error.message.includes('Insufficient balance')) {
      throw new ApiError(400, 'Insufficient wallet balance');
    }
    throw new ApiError(500, `Failed to submit withdrawal request: ${error.message}`);
  }

  return data as string;
}

/**
 * Returns own withdrawal requests history.
 */
export async function getMyWithdrawals(distributorId: string): Promise<WithdrawalRequest[]> {
  const { data, error } = await supabase
    .from('withdrawal_requests')
    .select('*')
    .eq('distributor_id', distributorId)
    .order('requested_at', { ascending: false });

  if (error) {
    throw new ApiError(500, `Failed to fetch withdrawal history: ${error.message}`);
  }

  return (data ?? []).map(req => ({
    ...req,
    amount: Number(req.amount),
  }));
}

/**
 * Returns all withdrawal requests (staff only). Optionally filters by status.
 */
export async function getAllWithdrawals(status?: string): Promise<WithdrawalRequest[]> {
  let query = supabase
    .from('withdrawal_requests')
    .select(`
      *,
      profiles!withdrawal_requests_distributor_id_fkey (
        full_name,
        distributor_id
      )
    `)
    .order('requested_at', { ascending: false });

  if (status) {
    query = query.eq('status', status);
  }

  const { data, error } = await query;

  if (error) {
    throw new ApiError(500, `Failed to fetch withdrawal requests: ${error.message}`);
  }

  return (data ?? []).map((req: any) => ({
    ...req,
    amount: Number(req.amount),
    profiles: req.profiles ? {
      full_name: req.profiles.full_name,
      distributor_id: req.profiles.distributor_id,
    } : undefined,
  }));
}

/**
 * Approves a pending withdrawal request (staff only).
 */
export async function approveWithdrawal(requestId: string, reviewedBy: string): Promise<void> {
  // Fetch request details before approval for notification
  const { data: request, error: fetchError } = await supabase
    .from('withdrawal_requests')
    .select('distributor_id, amount')
    .eq('id', requestId)
    .single();

  if (fetchError || !request) {
    throw new ApiError(404, 'Withdrawal request not found');
  }

  const { error } = await supabase.rpc('approve_withdrawal', {
    p_request_id: requestId,
    p_reviewed_by: reviewedBy,
  });

  if (error) {
    if (error.message.includes('not pending')) {
      throw new ApiError(400, 'Withdrawal request is not in pending status');
    }
    if (error.message.includes('not found')) {
      throw new ApiError(404, 'Withdrawal request not found');
    }
    throw new ApiError(500, `Failed to approve withdrawal: ${error.message}`);
  }

  // Log audit action
  await auditLogService.logAction(
    reviewedBy,
    'withdrawal_approved',
    'withdrawal_request',
    requestId,
    {
      distributor_id: request.distributor_id,
      amount: Number(request.amount),
    },
  );

  // Send notification
  try {
    await notificationService.notifyWithdrawalStatus(
      request.distributor_id,
      'approved',
      Number(request.amount),
      requestId,
    );
  } catch (notifError) {
    console.error(`❌ Failed to send withdrawal approval notification: ${notifError}`);
    // Don't throw - notification failure shouldn't break the approval
  }
}

/**
 * Rejects a pending withdrawal request (staff only).
 */
export async function rejectWithdrawal(
  requestId: string,
  reviewedBy: string,
  notes: string,
): Promise<void> {
  // Fetch request details before rejection for notification
  const { data: request, error: fetchError } = await supabase
    .from('withdrawal_requests')
    .select('distributor_id, amount')
    .eq('id', requestId)
    .single();

  if (fetchError || !request) {
    throw new ApiError(404, 'Withdrawal request not found');
  }

  const { error } = await supabase.rpc('reject_withdrawal', {
    p_request_id: requestId,
    p_reviewed_by: reviewedBy,
    p_notes: notes,
  });

  if (error) {
    if (error.message.includes('not pending')) {
      throw new ApiError(400, 'Withdrawal request is not in pending status');
    }
    if (error.message.includes('not found')) {
      throw new ApiError(404, 'Withdrawal request not found');
    }
    throw new ApiError(500, `Failed to reject withdrawal: ${error.message}`);
  }

  // Log audit action
  await auditLogService.logAction(
    reviewedBy,
    'withdrawal_rejected',
    'withdrawal_request',
    requestId,
    {
      distributor_id: request.distributor_id,
      amount: Number(request.amount),
      notes,
    },
  );

  // Send notification
  try {
    await notificationService.notifyWithdrawalStatus(
      request.distributor_id,
      'rejected',
      Number(request.amount),
      requestId,
      notes,
    );
  } catch (notifError) {
    console.error(`❌ Faled to send withdrawal rejection notification: ${notifError}`);
    // Don't throw - notification failure shouldn't break the rejection
  }
}

/**
 * Marks an approved withdrawal request as paid (staff only).
 */
export async function markWithdrawalPaid(requestId: string, reviewedBy: string): Promise<void> {
  // Fetch request details before marking as paid for notification
  const { data: request, error: fetchError } = await supabase
    .from('withdrawal_requests')
    .select('status, distributor_id, amount')
    .eq('id', requestId)
    .single();

  if (fetchError || !request) {
    throw new ApiError(404, 'Withdrawal request not found');
  }

  if (request.status !== 'approved') {
    throw new ApiError(400, 'Withdrawal request must be approved first');
  }

  const { error: updateError } = await supabase
    .from('withdrawal_requests')
    .update({
      status: 'paid',
      reviewed_by: reviewedBy,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', requestId);

  if (updateError) {
    throw new ApiError(500, `Failed to mark withdrawal request as paid: ${updateError.message}`);
  }

  // Send notification
  try {
    await notificationService.notifyWithdrawalStatus(
      request.distributor_id,
      'paid',
      Number(request.amount),
      requestId,
    );
  } catch (notifError) {
    console.error(`❌ Failed to send withdrawal paid notification: ${notifError}`);
    // Don't throw - notification failure shouldn't break the update
  }
}
