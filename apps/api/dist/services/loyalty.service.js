import { supabase } from '../config/supabase.js';
import { ApiError } from '../middleware/error.middleware.js';
export async function creditPoints(distributorId, sourceType, sourceId, points) {
    if (points <= 0) {
        throw new ApiError(400, 'Points must be greater than zero');
    }
    const { error: insertError } = await supabase
        .from('loyalty_balances')
        .insert({ distributor_id: distributorId, balance: 0.00, updated_at: new Date().toISOString() })
        .onConflict('distributor_id')
        .ignore();
    if (insertError) {
        throw new ApiError(500, `Failed to ensure loyalty balance: ${insertError.message}`);
    }
    const { data: currentBalanceRow, error: currentBalanceError } = await supabase
        .from('loyalty_balances')
        .select('balance')
        .eq('distributor_id', distributorId)
        .single();
    if (currentBalanceError || !currentBalanceRow) {
        throw new ApiError(500, `Failed to load loyalty balance: ${currentBalanceError?.message}`);
    }
    const currentBalance = Number(currentBalanceRow.balance);
    const newBalance = currentBalance + points;
    const { error: balanceUpdateError } = await supabase
        .from('loyalty_balances')
        .update({ balance: newBalance, updated_at: new Date().toISOString() })
        .eq('distributor_id', distributorId);
    if (balanceUpdateError) {
        throw new ApiError(500, `Failed to update loyalty balance: ${balanceUpdateError.message}`);
    }
    const { error: txError } = await supabase
        .from('loyalty_transactions')
        .insert({
        distributor_id: distributorId,
        type: 'earn',
        source_type: sourceType,
        source_id: sourceId,
        points,
        balance_after: newBalance,
    });
    if (txError) {
        throw new ApiError(500, `Failed to create loyalty transaction: ${txError.message}`);
    }
    return {
        distributor_id: distributorId,
        balance: newBalance,
        updated_at: new Date().toISOString(),
    };
}
export async function getMyLoyaltyBalance(distributorId) {
    const { error: insertError } = await supabase
        .from('loyalty_balances')
        .insert({ distributor_id: distributorId, balance: 0.00, updated_at: new Date().toISOString() })
        .onConflict('distributor_id')
        .ignore();
    if (insertError) {
        throw new ApiError(500, `Failed to ensure loyalty balance: ${insertError.message}`);
    }
    const { data, error } = await supabase
        .from('loyalty_balances')
        .select('*')
        .eq('distributor_id', distributorId)
        .single();
    if (error || !data) {
        throw new ApiError(500, `Failed to fetch loyalty balance: ${error?.message}`);
    }
    return {
        distributor_id: data.distributor_id,
        balance: Number(data.balance),
        updated_at: data.updated_at,
    };
}
export async function getMyLoyaltyHistory(distributorId, page = 1, limit = 20) {
    const offset = (page - 1) * limit;
    const { count, error: countError } = await supabase
        .from('loyalty_transactions')
        .select('*', { count: 'exact', head: true })
        .eq('distributor_id', distributorId);
    if (countError) {
        throw new ApiError(500, `Failed to count loyalty transactions: ${countError.message}`);
    }
    const { data, error } = await supabase
        .from('loyalty_transactions')
        .select('*')
        .eq('distributor_id', distributorId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);
    if (error) {
        throw new ApiError(500, `Failed to fetch loyalty history: ${error.message}`);
    }
    return {
        transactions: (data ?? []).map((row) => ({
            ...row,
            points: Number(row.points),
            balance_after: Number(row.balance_after),
        })),
        total: count ?? 0,
        page,
        limit,
    };
}
//# sourceMappingURL=loyalty.service.js.map