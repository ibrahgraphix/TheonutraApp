//wallet.services
import { supabase } from '../config/supabase.js';
import { ApiError } from '../middleware/error.middleware.js';
import * as notificationService from './notification.service.js';
import * as auditLogService from './auditLog.service.js';
/**
 * Ensures a wallet exists for a distributor, then returns the wallet and recent transactions.
 */
export async function getMyWallet(distributorId) {
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
export async function getMyTransactions(distributorId, page = 1, limit = 20) {
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
export async function requestWithdrawal(distributorId, amount, method, payoutDetails) {
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
    const { data: settings, error: settingsError } = await supabase
        .from('wallet_settings')
        .select('min_withdrawal, withdrawal_fee_pct')
        .eq('id', 1)
        .single();
    if (settingsError || !settings) {
        throw new ApiError(500, 'Wallet settings not configured');
    }
    if (amount < Number(settings.min_withdrawal)) {
        throw new ApiError(400, `Minimum withdrawal amount is ${settings.min_withdrawal}`);
    }
    const feeAmount = amount * (Number(settings.withdrawal_fee_pct) / 100);
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
    return data;
}
/**
 * Returns own withdrawal requests history.
 */
export async function getMyWithdrawals(distributorId) {
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
export async function getAllWithdrawals(status) {
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
    return (data ?? []).map((req) => ({
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
export async function approveWithdrawal(requestId, reviewedBy) {
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
    await auditLogService.logAction(reviewedBy, 'withdrawal_approved', 'withdrawal_request', requestId, {
        distributor_id: request.distributor_id,
        amount: Number(request.amount),
    });
    // Send notification
    try {
        await notificationService.notifyWithdrawalStatus(request.distributor_id, 'approved', Number(request.amount), requestId);
    }
    catch (notifError) {
        console.error(`❌ Failed to send withdrawal approval notification: ${notifError}`);
        // Don't throw - notification failure shouldn't break the approval
    }
}
/**
 * Rejects a pending withdrawal request (staff only).
 */
export async function rejectWithdrawal(requestId, reviewedBy, notes) {
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
    await auditLogService.logAction(reviewedBy, 'withdrawal_rejected', 'withdrawal_request', requestId, {
        distributor_id: request.distributor_id,
        amount: Number(request.amount),
        notes,
    });
    // Send notification
    try {
        await notificationService.notifyWithdrawalStatus(request.distributor_id, 'rejected', Number(request.amount), requestId, notes);
    }
    catch (notifError) {
        console.error(`❌ Faled to send withdrawal rejection notification: ${notifError}`);
        // Don't throw - notification failure shouldn't break the rejection
    }
}
/**
 * Marks an approved withdrawal request as paid (staff only).
 */
export async function markWithdrawalPaid(requestId, reviewedBy) {
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
        await notificationService.notifyWithdrawalStatus(request.distributor_id, 'paid', Number(request.amount), requestId);
    }
    catch (notifError) {
        console.error(`❌ Failed to send withdrawal paid notification: ${notifError}`);
        // Don't throw - notification failure shouldn't break the update
    }
}
//# sourceMappingURL=wallet.service.js.map