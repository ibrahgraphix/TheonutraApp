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
  status: 'pending' | 'approved' | 'rejected' | 'paid' | 'failed' | 'cancelled';
  requested_at: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  notes: string | null;
  created_at: string | null;
  currencyCode?: string;
  profiles?: {
    full_name: string;
    distributor_id: string;
  };
  full_name?: string; // Added for direct profile name access
}

/**
 * Ensures a wallet exists for a distributor, then returns the wallet and recent transactions.
 */
export async function getMyWallet(distributorId: string): Promise<{ balance: number; currency: string; recentTransactions: WalletTransaction[] }> {
  // Get currency from profile first
  let currency = 'USD';
  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('countries!inner(currency_code)')
      .eq('id', distributorId)
      .single();
    
    if (profile) {
      currency = (profile as any)?.countries?.currency_code || 'USD';
    }
  } catch (error) {
    // If profile fetch fails, default to USD
    console.error('Failed to fetch currency from profile:', error);
    currency = 'USD';
  }

  // Ensure wallet exists by trying to insert a zero-balance wallet
  try {
    const { error: insertError } = await supabase
      .from('wallets')
      .insert({ distributor_id: distributorId, balance: 0.00 });

    if (insertError && insertError.code !== '23505') { // Ignore unique key violation
      console.error('Failed to ensure wallet:', insertError.message);
    }
  } catch (error) {
    console.error('Error ensuring wallet exists:', error);
  }

  // Fetch the wallet (use separate queries for better error handling)
  let balance = 0;
  try {
    const { data: wallet, error: walletError } = await supabase
      .from('wallets')
      .select('balance')
      .eq('distributor_id', distributorId)
      .single();

    if (!walletError && wallet) {
      balance = Number(wallet.balance);
    }
  } catch (error) {
    console.error('Failed to fetch wallet balance:', error);
    balance = 0;
  }

  // Fetch recent transactions (top 10)
  let transactions: WalletTransaction[] = [];
  try {
    const { data: txData, error: txError } = await supabase
      .from('wallet_transactions')
      .select('*')
      .eq('distributor_id', distributorId)
      .order('created_at', { ascending: false })
      .limit(10);

    if (!txError && txData) {
      transactions = txData.map(tx => ({
        id: tx.id,
        distributor_id: tx.distributor_id,
        type: tx.type,
        source_type: tx.source_type,
        source_id: tx.source_id,
        amount: Number(tx.amount),
        balance_after: Number(tx.balance_after),
        created_at: tx.created_at,
      }));
    }
  } catch (error) {
    console.error('Failed to fetch recent transactions:', error);
    transactions = [];
  }

  return {
    balance,
    currency,
    recentTransactions: transactions,
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
      id: tx.id,
      distributor_id: tx.distributor_id,
      type: tx.type,
      source_type: tx.source_type,
      source_id: tx.source_id,
      amount: Number(tx.amount),
      balance_after: Number(tx.balance_after),
      created_at: tx.created_at,
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

  const DEFAULT_MIN_WITHDRAWAL = 20000;
  const DEFAULT_FEE_PCT = 2;

  let minWithdrawal = DEFAULT_MIN_WITHDRAWAL;
  let withdrawalFeePct = DEFAULT_FEE_PCT;

  try {
    const { data: settings, error: settingsError } = await supabase
      .from('wallet_settings')
      .select('min_withdrawal, withdrawal_fee_pct')
      .eq('id', 1)
      .single();

    if (!settingsError && settings) {
      minWithdrawal = Number(settings.min_withdrawal);
      withdrawalFeePct = Number(settings.withdrawal_fee_pct);
    }
    // If error (e.g. table missing) → silently use defaults
  } catch {
    // Table not yet created — use defaults
  }

  if (amount < minWithdrawal) {
    throw new ApiError(
      400,
      `Minimum withdrawal amount is ${minWithdrawal}`,
    );
  }

  const feeAmount = amount * (withdrawalFeePct / 100);
  const netAmount = amount - feeAmount;

  const { data, error } = await supabase.rpc('create_withdrawal_request', {
    p_distributor_id: distributorId,
    p_amount: amount,
    p_method: method,
    p_payout_details: `${payoutDetails} (fee: ${feeAmount.toFixed(2)}, net: ${netAmount.toFixed(2)})`,
  });

  if (error) {
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
  // Fetch withdrawal requests without embedded profiles first
  const { data, error } = await supabase
    .from('withdrawal_requests')
    .select('*')
    .eq('distributor_id', distributorId)
    .order('requested_at', { ascending: false });

  if (error) {
    throw new ApiError(500, `Failed to fetch withdrawal history: ${error.message}`);
  }

  // Get currency from profile separately to avoid relationship ambiguity
  let currency = 'USD';
  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('countries!inner(currency_code)')
      .eq('id', distributorId)
      .single();
    
    if (profile) {
      currency = (profile as any)?.countries?.currency_code || 'USD';
    }
  } catch (error) {
    console.error('Failed to fetch currency for withdrawals:', error);
    currency = 'USD';
  }

  return (data ?? []).map(req => ({
    ...req,
    amount: Number(req.amount),
    currencyCode: currency,
    created_at: req.requested_at ? new Date(req.requested_at).toISOString() : null,
    requested_at: req.requested_at ? new Date(req.requested_at).toISOString() : null,
    reviewed_at: req.reviewed_at ? new Date(req.reviewed_at).toISOString() : null,
  }));
}

/**
 * Returns all withdrawal requests (staff only). Optionally filters by status.
 */
export async function getAllWithdrawals(status?: string): Promise<WithdrawalRequest[]> {
  // Fetch withdrawal requests without embedded profiles first
  let query = supabase
    .from('withdrawal_requests')
    .select('*')
    .order('requested_at', { ascending: false });

  if (status) {
    query = query.eq('status', status);
  }

  const { data, error } = await query;

  if (error) {
    throw new ApiError(500, `Failed to fetch withdrawal requests: ${error.message}`);
  }

  // Get all distributor IDs to fetch their profiles in batch
  const distributorIds = [...new Set((data ?? []).map(req => req.distributor_id as string))];
  
  const profileMap = new Map<string, { full_name: string; distributor_id: string; currency_code: string }>();
  
  if (distributorIds.length > 0) {
    try {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, distributor_id, countries!inner(currency_code)')
        .in('id', distributorIds);
      
      for (const profile of profiles ?? []) {
        profileMap.set(profile.id as string, {
          full_name: profile.full_name as string,
          distributor_id: profile.distributor_id as string,
          currency_code: (profile as any)?.countries?.currency_code || 'USD',
        });
      }
    } catch (error) {
      console.error('Failed to fetch profiles for withdrawals:', error);
    }
  }

  return (data ?? []).map((req: any) => {
    const profile = profileMap.get(req.distributor_id as string);
    return {
      ...req,
      amount: Number(req.amount),
      created_at: req.requested_at ? new Date(req.requested_at).toISOString() : null,
      requested_at: req.requested_at ? new Date(req.requested_at).toISOString() : null,
      reviewed_at: req.reviewed_at ? new Date(req.reviewed_at).toISOString() : null,
      currencyCode: profile?.currency_code || 'USD',
      full_name: profile?.full_name,
      profiles: profile ? {
        full_name: profile.full_name,
        distributor_id: profile.distributor_id,
      } : undefined,
    };
  });
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
 * Marks a pending withdrawal request as failed (staff only).
 */
export async function failWithdrawal(
  requestId: string,
  reviewedBy: string,
  notes: string,
): Promise<void> {
  // Fetch request details before failing for notification
  const { data: request, error: fetchError } = await supabase
    .from('withdrawal_requests')
    .select('distributor_id, amount')
    .eq('id', requestId)
    .single();

  if (fetchError || !request) {
    throw new ApiError(404, 'Withdrawal request not found');
  }

  const { error } = await supabase.rpc('fail_withdrawal', {
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
    throw new ApiError(500, `Failed to fail withdrawal: ${error.message}`);
  }

  // Log audit action
  await auditLogService.logAction(
    reviewedBy,
    'withdrawal_failed',
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
      'failed',
      Number(request.amount),
      requestId,
      notes,
    );
  } catch (notifError) {
    console.error(`❌ Failed to send withdrawal failed notification: ${notifError}`);
    // Don't throw - notification failure shouldn't break the operation
  }
}

/**
 * Cancels a pending withdrawal request (staff only).
 */
export async function cancelWithdrawal(
  requestId: string,
  reviewedBy: string,
): Promise<void> {
  // Fetch request details before cancellation for notification
  const { data: request, error: fetchError } = await supabase
    .from('withdrawal_requests')
    .select('distributor_id, amount')
    .eq('id', requestId)
    .single();

  if (fetchError || !request) {
    throw new ApiError(404, 'Withdrawal request not found');
  }

  const { error } = await supabase.rpc('cancel_withdrawal', {
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
    throw new ApiError(500, `Failed to cancel withdrawal: ${error.message}`);
  }

  // Log audit action
  await auditLogService.logAction(
    reviewedBy,
    'withdrawal_cancelled',
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
      'cancelled',
      Number(request.amount),
      requestId,
    );
  } catch (notifError) {
    console.error(`❌ Failed to send withdrawal cancelled notification: ${notifError}`);
    // Don't throw - notification failure shouldn't break the operation
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

/**
 * Marks a withdrawal request as failed (staff only).
 * Used when payout attempt doesn't go through.
 */
export async function markWithdrawalFailed(requestId: string, reviewedBy: string, notes?: string): Promise<void> {
  // Fetch request details before marking as failed for notification
  const { data: request, error: fetchError } = await supabase
    .from('withdrawal_requests')
    .select('status, distributor_id, amount')
    .eq('id', requestId)
    .single();

  if (fetchError || !request) {
    throw new ApiError(404, 'Withdrawal request not found');
  }

  // Can fail from approved or paid status (if payment failed after being marked paid)
  if (request.status !== 'approved' && request.status !== 'paid') {
    throw new ApiError(400, 'Withdrawal request must be approved or paid first');
  }

  const { error: updateError } = await supabase
    .from('withdrawal_requests')
    .update({
      status: 'failed',
      reviewed_by: reviewedBy,
      reviewed_at: new Date().toISOString(),
      notes: notes || null,
    })
    .eq('id', requestId);

  if (updateError) {
    throw new ApiError(500, `Failed to mark withdrawal request as failed: ${updateError.message}`);
  }

  // Refund the amount back to wallet
  const { data: wallet } = await supabase
    .from('wallets')
    .select('balance')
    .eq('distributor_id', request.distributor_id)
    .maybeSingle();

  const currentBalance = Number(wallet?.balance ?? 0);
  const newBalance = currentBalance + Number(request.amount);

  await supabase
    .from('wallets')
    .upsert({ distributor_id: request.distributor_id, balance: newBalance }, { onConflict: 'distributor_id' });

  await supabase.from('wallet_transactions').insert({
    distributor_id: request.distributor_id,
    type: 'credit',
    source_type: 'withdrawal_refund',
    source_id: requestId,
    amount: request.amount,
    balance_after: newBalance,
  });

  // Send notification
  try {
    await notificationService.notifyWithdrawalStatus(
      request.distributor_id,
      'failed',
      Number(request.amount),
      requestId,
      notes,
    );
  } catch (notifError) {
    console.error(`❌ Failed to send withdrawal failed notification: ${notifError}`);
    // Don't throw - notification failure shouldn't break the update
  }
}

/**
 * Cancels a withdrawal request (distributor or staff).
 * Used when cancellation happens before processing.
 */
export async function cancelWithdrawal(requestId: string, userId: string): Promise<void> {
  // Fetch request details before cancelling for notification
  const { data: request, error: fetchError } = await supabase
    .from('withdrawal_requests')
    .select('status, distributor_id, amount')
    .eq('id', requestId)
    .single();

  if (fetchError || !request) {
    throw new ApiError(404, 'Withdrawal request not found');
  }

  // Can only cancel pending requests
  if (request.status !== 'pending') {
    throw new ApiError(400, 'Can only cancel pending withdrawal requests');
  }

  const { error: updateError } = await supabase
    .from('withdrawal_requests')
    .update({
      status: 'cancelled',
      reviewed_by: userId,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', requestId);

  if (updateError) {
    throw new ApiError(500, `Failed to cancel withdrawal request: ${updateError.message}`);
  }

  // Refund the amount back to wallet
  const { data: wallet } = await supabase
    .from('wallets')
    .select('balance')
    .eq('distributor_id', request.distributor_id)
    .maybeSingle();

  const currentBalance = Number(wallet?.balance ?? 0);
  const newBalance = currentBalance + Number(request.amount);

  await supabase
    .from('wallets')
    .upsert({ distributor_id: request.distributor_id, balance: newBalance }, { onConflict: 'distributor_id' });

  await supabase.from('wallet_transactions').insert({
    distributor_id: request.distributor_id,
    type: 'credit',
    source_type: 'withdrawal_refund',
    source_id: requestId,
    amount: request.amount,
    balance_after: newBalance,
  });

  // Send notification
  try {
    await notificationService.notifyWithdrawalStatus(
      request.distributor_id,
      'cancelled',
      Number(request.amount),
      requestId,
    );
  } catch (notifError) {
    console.error(`❌ Failed to send withdrawal cancelled notification: ${notifError}`);
    // Don't throw - notification failure shouldn't break the cancellation
  }
}
