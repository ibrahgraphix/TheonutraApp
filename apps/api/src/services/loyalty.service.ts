import { supabase } from '../config/supabase.js';
import { ApiError } from '../middleware/error.middleware.js';

export type LoyaltyTransactionType = 'earn' | 'redeem' | 'adjustment';

export interface LoyaltyTransaction {
  id: string;
  distributor_id: string;
  type: LoyaltyTransactionType;
  source_type: string;
  source_id: string | null;
  points: number;
  balance_after: number;
  created_at: string;
}

/**
 * Credits loyalty points to a distributor.
 * Uses an RPC function for atomic balance update and ledger entry.
 */
export async function creditPoints(
  distributorId: string,
  sourceType: string,
  sourceId: string | null,
  points: number,
): Promise<void> {
  const { error } = await supabase.rpc('credit_loyalty_points', {
    p_distributor_id: distributorId,
    p_source_type: sourceType,
    p_source_id: sourceId,
    p_points: points,
  });

  if (error) {
    throw new ApiError(500, `Failed to credit loyalty points: ${error.message}`);
  }
}

/**
 * Gets the loyalty balance for a distributor.
 */
export async function getMyLoyaltyBalance(distributorId: string): Promise<{ balance: number }> {
  // Ensure loyalty_balance column exists and is initialized
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('loyalty_balance')
    .eq('id', distributorId)
    .single();

  if (profileError || !profile) {
    throw new ApiError(404, 'Profile not found');
  }

  return {
    balance: Number(profile.loyalty_balance || 0),
  };
}

/**
 * Gets paginated loyalty transaction history for a distributor.
 */
export async function getMyLoyaltyHistory(
  distributorId: string,
  page: number = 1,
  limit: number = 20,
): Promise<{ transactions: LoyaltyTransaction[]; total: number; page: number; limit: number }> {
  const offset = (page - 1) * limit;

  // Get total count
  const { count, error: countError } = await supabase
    .from('loyalty_transactions')
    .select('*', { count: 'exact', head: true })
    .eq('profile_id', distributorId);

  if (countError) {
    throw new ApiError(500, `Failed to count loyalty transactions: ${countError.message}`);
  }

  // Get paginated transactions
  const { data, error } = await supabase
    .from('loyalty_transactions')
    .select('*')
    .eq('profile_id', distributorId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    throw new ApiError(500, `Failed to fetch loyalty transactions: ${error.message}`);
  }

  return {
    transactions: (data ?? []).map(tx => ({
      ...tx,
      points: Number(tx.points),
      balance_after: Number(tx.balance_after),
    })),
    total: count ?? 0,
    page,
    limit,
  };
}
