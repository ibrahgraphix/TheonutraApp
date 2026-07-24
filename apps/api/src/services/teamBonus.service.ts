import { supabase } from '../config/supabase.js';
import { ApiError } from '../middleware/error.middleware.js';
import * as notificationService from './notification.service.js';

export interface TeamBonusLevel {
  level: number;
  teamPV: number;
  teamSales: number;
  percentage: number;
  bonusAmount: number;
}

export interface TeamBonusSummary {
  distributorId: string;
  period: string;
  totalTeamPV: number;
  totalTeamSales: number;
  totalBonus: number;
  breakdown: TeamBonusLevel[];
}

export interface TeamBonusHistory {
  id: string;
  distributorId: string;
  period: string;
  totalBonus: number;
  createdAt: string;
}

/**
 * Calculates team bonus for a distributor for a given period.
 * Walks the downline, groups by level, applies rank-appropriate rates.
 */
export async function calculateTeamBonus(
  distributorId: string,
  period: string,
): Promise<TeamBonusSummary> {
  // Parse period (YYYY-MM)
  const parts = period.split('-');
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const startStr = new Date(Date.UTC(year, month, 1)).toISOString();
  const endStr = new Date(Date.UTC(year, month + 1, 1)).toISOString();

  // Get distributor's current rank
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('rank_id, ranks (name, level_order)')
    .eq('id', distributorId)
    .single();

  if (profileError || !profile) {
    throw new ApiError(404, 'Distributor profile not found');
  }

  const rankId = profile.rank_id as string;
  
  // If no rank assigned, default to Member rank
  if (!rankId) {
    const { data: memberRank } = await supabase
      .from('ranks')
      .select('id')
      .eq('name', 'Member')
      .single();
    
    if (!memberRank) {
      throw new ApiError(500, 'Member rank not found');
    }
    
    // Return zero bonus for unranked distributors
    return {
      distributorId,
      period,
      totalTeamPV: 0,
      totalTeamSales: 0,
      totalBonus: 0,
      breakdown: [],
    };
  }

  const rankData = profile.ranks as any;
  const rankName = rankData?.name;

  // Get team bonus rates for this rank
  const { data: rates, error: ratesError } = await supabase
    .from('team_bonus_rates')
    .select('level, percentage')
    .eq('rank_id', rankId)
    .order('level', { ascending: true });

  if (ratesError) {
    throw new ApiError(500, `Failed to fetch team bonus rates: ${ratesError.message}`);
  }

  if (!rates || rates.length === 0) {
    // No rates configured for this rank - return zero bonus
    return {
      distributorId,
      period,
      totalTeamPV: 0,
      totalTeamSales: 0,
      totalBonus: 0,
      breakdown: [],
    };
  }

  // Get downline from downline_tree view
  const { data: downline, error: downlineError } = await supabase
    .from('downline_tree')
    .select('member_id, level')
    .eq('root_id', distributorId);

  if (downlineError) {
    throw new ApiError(500, `Failed to fetch downline: ${downlineError.message}`);
  }

  if (!downline || downline.length === 0) {
    // No downline - return zero bonus
    return {
      distributorId,
      period,
      totalTeamPV: 0,
      totalTeamSales: 0,
      totalBonus: 0,
      breakdown: [],
    };
  }

  const memberIds = downline.map((d) => d.member_id);

  // Group downline members by their level relative to the distributor
  const levelGroups = new Map<number, string[]>();
  for (const member of downline) {
    const level = member.level as number;
    if (!levelGroups.has(level)) {
      levelGroups.set(level, []);
    }
    levelGroups.get(level)!.push(member.member_id);
  }

  // Calculate PV and sales for each level
  const breakdown: TeamBonusLevel[] = [];
  let totalTeamPV = 0;
  let totalTeamSales = 0;
  let totalBonus = 0;

  for (const rate of rates) {
    const level = rate.level as number;
    const percentage = Number(rate.percentage);

    // Get members at this level
    const membersAtLevel = levelGroups.get(level) || [];
    if (membersAtLevel.length === 0) continue;

    // Calculate PV from orders for this level
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select(`
        id,
        order_items!inner (
          quantity,
          products!inner (
            pv
          )
        )
      `)
      .in('buyer_id', membersAtLevel)
      .eq('status', 'paid')
      .gte('created_at', startStr)
      .lt('created_at', endStr);

    if (ordersError) {
      throw new ApiError(500, `Failed to calculate level ${level} PV: ${ordersError.message}`);
    }

    let levelPV = 0;
    let levelSales = 0;
    for (const order of orders ?? []) {
      const items = order.order_items as any[];
      for (const item of items ?? []) {
        levelPV += Number(item.quantity) * Number(item.products?.pv ?? 0);
        levelSales += Number(item.quantity) * Number(item.products?.pv ?? 0); // Simplified - using PV as sales proxy
      }
    }

    // Also include customer sales PV
    const { data: customerSales, error: salesError } = await supabase
      .from('customer_sales')
      .select(`
        id,
        customer_sale_items!inner (
          quantity,
          pv_at_sale
        )
      `)
      .in('distributor_id', membersAtLevel)
      .gte('created_at', startStr)
      .lt('created_at', endStr);

    if (salesError) {
      throw new ApiError(500, `Failed to calculate level ${level} customer sales PV: ${salesError.message}`);
    }

    for (const sale of customerSales ?? []) {
      const items = sale.customer_sale_items as any[];
      for (const item of items ?? []) {
        levelPV += Number(item.quantity) * Number(item.pv_at_sale ?? 0);
        levelSales += Number(item.quantity) * Number(item.pv_at_sale ?? 0);
      }
    }

    // Calculate bonus for this level
    const bonusAmount = levelPV * (percentage / 100);

    totalTeamPV += levelPV;
    totalTeamSales += levelSales;
    totalBonus += bonusAmount;

    breakdown.push({
      level,
      teamPV: levelPV,
      teamSales: levelSales,
      percentage,
      bonusAmount,
    });
  }

  return {
    distributorId,
    period,
    totalTeamPV,
    totalTeamSales,
    totalBonus,
    breakdown,
  };
}

/**
 * Runs team bonus calculation for all distributors for a given period.
 * Creates commission entries for team bonuses.
 * Idempotent - checks for existing entries before creating new ones.
 */
export async function runTeamBonusBatch(
  period: string,
  staffId: string,
): Promise<{ processed: number; skipped: number }> {
  // staffId is used for audit/authorization but doesn't need to be a distributor profile
  // The service operates on all distributors regardless
  // Parse period
  const parts = period.split('-');
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const startStr = new Date(Date.UTC(year, month, 1)).toISOString();
  const endStr = new Date(Date.UTC(year, month + 1, 1)).toISOString();

  // Get all active distributors
  const { data: distributors, error: distError } = await supabase
    .from('profiles')
    .select('id, rank_id')
    .eq('is_active', true)
    .eq('role', 'distributor');

  if (distError) {
    throw new ApiError(500, `Failed to fetch distributors: ${distError.message}`);
  }

  let processed = 0;
  let skipped = 0;

  for (const distributor of distributors ?? []) {
    const distId = distributor.id;

    // Check if team bonus already exists for this distributor and period
    const { data: existing, error: checkError } = await supabase
      .from('commissions')
      .select('id')
      .eq('beneficiary_id', distId)
      .eq('bonus_type', 'team_bonus')
      .gte('created_at', startStr)
      .lt('created_at', endStr)
      .limit(1);

    if (checkError) {
      throw new ApiError(500, `Failed to check existing bonuses: ${checkError.message}`);
    }

    if (existing && existing.length > 0) {
      skipped++;
      continue;
    }

    // Calculate team bonus for this distributor
    const summary = await calculateTeamBonus(distId, period);

    if (summary.totalBonus <= 0) {
      skipped++;
      continue;
    }

    // Create commission entries for each level
    for (const levelBreakdown of summary.breakdown) {
      if (levelBreakdown.bonusAmount <= 0) continue;

      const { error: insertError } = await supabase
        .from('commissions')
        .insert({
          beneficiary_id: distId,
          bonus_type: 'team_bonus',
          amount: levelBreakdown.bonusAmount,
          level: levelBreakdown.level,
          source_distributor_id: distId, // Self as source for team bonus
          created_at: new Date().toISOString(),
        });

      if (insertError) {
        throw new ApiError(500, `Failed to create team bonus commission: ${insertError.message}`);
      }

      // Send notification for this level's bonus
      try {
        await notificationService.notifyTeamBonusEarned(
          distId,
          levelBreakdown.bonusAmount,
          period,
        );
      } catch (notifError) {
        console.error(`❌ Failed to send team bonus notification for ${distId}: ${notifError}`);
        // Don't throw - notification failure shouldn't break the bonus creation
      }
    }

    processed++;
  }

  return { processed, skipped };
}

/**
 * Returns paginated team bonus history for a distributor
 */
export async function getTeamBonusHistory(
  distributorId: string,
  page: number = 1,
  limit: number = 20,
): Promise<{ history: TeamBonusHistory[]; total: number; page: number; limit: number }> {
  const offset = (page - 1) * limit;

  // Get total count
  const { count, error: countError } = await supabase
    .from('commissions')
    .select('*', { count: 'exact', head: true })
    .eq('beneficiary_id', distributorId)
    .eq('bonus_type', 'team_bonus');

  if (countError) {
    throw new ApiError(500, `Failed to count team bonus history: ${countError.message}`);
  }

  // Get paginated history
  const { data, error } = await supabase
    .from('commissions')
    .select('id, beneficiary_id, amount, created_at')
    .eq('beneficiary_id', distributorId)
    .eq('bonus_type', 'team_bonus')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    throw new ApiError(500, `Failed to fetch team bonus history: ${error.message}`);
  }

  const history = (data ?? []).map((row) => ({
    id: row.id,
    distributorId: row.beneficiary_id,
    period: new Date(row.created_at).toISOString().slice(0, 7), // YYYY-MM
    totalBonus: Number(row.amount),
    createdAt: row.created_at,
  }));

  return {
    history,
    total: count ?? 0,
    page,
    limit,
  };
}

/**
 * Gets team bonus rates configuration (admin only)
 */
export async function getTeamBonusRates(): Promise<any[]> {
  const { data, error } = await supabase
    .from('team_bonus_rates')
    .select(`
      id,
      rank_id,
      level,
      percentage,
      ranks!inner (
        name
      )
    `)
    .order('rank_id')
    .order('level', { ascending: true });

  if (error) {
    throw new ApiError(500, `Failed to fetch team bonus rates: ${error.message}`);
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    rankId: row.rank_id,
    rankName: (row.ranks as any).name,
    level: row.level,
    percentage: Number(row.percentage),
  }));
}

/**
 * Updates team bonus rates (admin only)
 */
export async function updateTeamBonusRates(
  rates: Array<{ rankId: string; level: number; percentage: number }>,
): Promise<void> {
  for (const rate of rates) {
    const { error } = await supabase
      .from('team_bonus_rates')
      .upsert({
        rank_id: rate.rankId,
        level: rate.level,
        percentage: rate.percentage,
      }, { onConflict: 'rank_id,level' });

    if (error) {
      throw new ApiError(500, `Failed to update team bonus rate: ${error.message}`);
    }
  }
}
