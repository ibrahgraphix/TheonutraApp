import { supabase } from '../config/supabase.js';
import { ApiError } from '../middleware/error.middleware.js';

export interface ManualBonus {
  id: string;
  distributor_id: string;
  bonus_category: 'leadership' | 'rank_achievement' | 'monthly_performance' | 'other';
  amount: number;
  note: string | null;
  awarded_by: string;
  awarded_at: string;
  profiles?: {
    full_name: string;
    distributor_id: string;
  };
  staff?: {
    full_name: string;
    distributor_id: string;
  };
}

/**
 * Inserts a manual bonus record (which automatically triggers the wallet credit/ledger entry).
 */
export async function awardBonus(
  staffId: string,
  distributorId: string,
  category: 'leadership' | 'rank_achievement' | 'monthly_performance' | 'other',
  amount: number,
  note?: string,
): Promise<ManualBonus> {
  const { data, error } = await supabase
    .from('manual_bonuses')
    .insert({
      distributor_id: distributorId,
      bonus_category: category,
      amount,
      note: note || null,
      awarded_by: staffId,
    })
    .select(`
      *,
      profiles!manual_bonuses_distributor_id_fkey (
        full_name,
        distributor_id
      ),
      staff:profiles!manual_bonuses_awarded_by_fkey (
        full_name,
        distributor_id
      )
    `)
    .single();

  if (error || !data) {
    throw new ApiError(500, `Failed to award manual bonus: ${error?.message}`);
  }

  return {
    ...data,
    amount: Number(data.amount),
    profiles: data.profiles ? {
      full_name: data.profiles.full_name,
      distributor_id: data.profiles.distributor_id,
    } : undefined,
    staff: data.staff ? {
      full_name: data.staff.full_name,
      distributor_id: data.staff.distributor_id,
    } : undefined,
  } as any;
}

/**
 * Returns paginated list of manual bonuses for a specific distributor.
 */
export async function listBonusesForDistributor(
  distributorId: string,
  page: number = 1,
  limit: number = 20,
): Promise<{ bonuses: ManualBonus[]; total: number; page: number; limit: number }> {
  const offset = (page - 1) * limit;

  // Get total count
  const { count, error: countError } = await supabase
    .from('manual_bonuses')
    .select('*', { count: 'exact', head: true })
    .eq('distributor_id', distributorId);

  if (countError) {
    throw new ApiError(500, `Failed to count manual bonuses: ${countError.message}`);
  }

  // Get paginated list
  const { data, error } = await supabase
    .from('manual_bonuses')
    .select(`
      *,
      staff:profiles!manual_bonuses_awarded_by_fkey (
        full_name,
        distributor_id
      )
    `)
    .eq('distributor_id', distributorId)
    .order('awarded_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    throw new ApiError(500, `Failed to fetch manual bonuses: ${error.message}`);
  }

  return {
    bonuses: (data ?? []).map(row => ({
      ...row,
      amount: Number(row.amount),
      staff: row.staff ? {
        full_name: row.staff.full_name,
        distributor_id: row.staff.distributor_id,
      } : undefined,
    })) as any[],
    total: count ?? 0,
    page,
    limit,
  };
}

export interface ListBonusesFilters {
  category?: string;
  distributorId?: string;
  startDate?: string;
  endDate?: string;
}

/**
 * Returns a filterable, paginated list of all manual bonuses (staff only).
 */
export async function listAllBonuses(
  filters: ListBonusesFilters,
  page: number = 1,
  limit: number = 20,
): Promise<{ bonuses: ManualBonus[]; total: number; page: number; limit: number }> {
  const offset = (page - 1) * limit;

  let query = supabase
    .from('manual_bonuses')
    .select(`
      *,
      profiles!manual_bonuses_distributor_id_fkey (
        full_name,
        distributor_id
      ),
      staff:profiles!manual_bonuses_awarded_by_fkey (
        full_name,
        distributor_id
      )
    `, { count: 'exact' });

  if (filters.category) {
    query = query.eq('bonus_category', filters.category);
  }
  if (filters.distributorId) {
    query = query.eq('distributor_id', filters.distributorId);
  }
  if (filters.startDate) {
    query = query.gte('awarded_at', filters.startDate);
  }
  if (filters.endDate) {
    query = query.lte('awarded_at', filters.endDate);
  }

  const { data, count, error } = await query
    .order('awarded_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    throw new ApiError(500, `Failed to fetch manual bonuses list: ${error.message}`);
  }

  return {
    bonuses: (data ?? []).map(row => ({
      ...row,
      amount: Number(row.amount),
      profiles: row.profiles ? {
        full_name: row.profiles.full_name,
        distributor_id: row.profiles.distributor_id,
      } : undefined,
      staff: row.staff ? {
        full_name: row.staff.full_name,
        distributor_id: row.staff.distributor_id,
      } : undefined,
    })) as any[],
    total: count ?? 0,
    page,
    limit,
  };
}
