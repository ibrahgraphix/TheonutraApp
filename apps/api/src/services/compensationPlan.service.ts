import { supabase } from '../config/supabase.js';
import { ApiError } from '../middleware/error.middleware.js';
import { getMyTeam } from './team.service.js';
import * as notificationService from './notification.service.js';

export interface ActiveStatusRank {
  id: string;
  name: string;
  level_order: number;
  min_cgv: number;
  min_ppv: number;
  opb_percent: number;
}

export interface LeadershipRank {
  id: string;
  name: string;
  level_order: number;
  required_downline_leaders: number;
  min_ppv: number;
}

export async function listActiveStatusRanks(): Promise<ActiveStatusRank[]> {
  const { data, error } = await supabase
    .from('active_status_ranks')
    .select('*')
    .order('level_order', { ascending: true });
  if (error) throw new ApiError(500, `Failed to fetch active status ranks: ${error.message}`);
  return (data ?? []).map((r) => ({
    id: r.id, name: r.name, level_order: r.level_order,
    min_cgv: Number(r.min_cgv), min_ppv: Number(r.min_ppv), opb_percent: Number(r.opb_percent),
  }));
}

export async function listLeadershipRanks(): Promise<LeadershipRank[]> {
  const { data, error } = await supabase
    .from('leadership_ranks')
    .select('*')
    .order('level_order', { ascending: true });
  if (error) throw new ApiError(500, `Failed to fetch leadership ranks: ${error.message}`);
  return (data ?? []).map((r) => ({
    id: r.id, name: r.name, level_order: r.level_order,
    required_downline_leaders: r.required_downline_leaders, min_ppv: Number(r.min_ppv),
  }));
}

/**
 * PPV (Personal Point Value) — same PV calculation already used elsewhere
 * (order_items + customer_sale_items PV for the given month).
 */
export async function calculatePPV(distributorId: string, month?: string): Promise<number> {
  const { startStr, endStr } = monthRange(month);

  const { data: orders, error: ordersError } = await supabase
    .from('orders')
    .select(`id, order_items!inner ( quantity, products!inner ( pv ) )`)
    .eq('buyer_id', distributorId)
    .eq('status', 'paid')
    .gte('created_at', startStr)
    .lt('created_at', endStr);
  if (ordersError) throw new ApiError(500, `Failed to calculate PPV from orders: ${ordersError.message}`);

  let ppv = 0;
  for (const order of orders ?? []) {
    for (const item of (order.order_items as any[]) ?? []) {
      ppv += Number(item.quantity) * Number(item.products?.pv ?? 0);
    }
  }

  const { data: sales, error: salesError } = await supabase
    .from('customer_sales')
    .select(`id, customer_sale_items!inner ( quantity, pv_at_sale )`)
    .eq('distributor_id', distributorId)
    .gte('created_at', startStr)
    .lt('created_at', endStr);
  if (salesError) throw new ApiError(500, `Failed to calculate PPV from customer sales: ${salesError.message}`);

  for (const sale of sales ?? []) {
    for (const item of (sale.customer_sale_items as any[]) ?? []) {
      ppv += Number(item.quantity) * Number(item.pv_at_sale ?? 0);
    }
  }

  return ppv;
}

/**
 * CGV (Combined Group Volume) — PPV of the distributor plus PPV of their
 * ENTIRE downline (all levels), for the given month.
 */
export async function calculateCGV(distributorId: string, month?: string): Promise<number> {
  const ownPPV = await calculatePPV(distributorId, month);
  const team = await getMyTeam(distributorId);

  let teamPPV = 0;
  for (const member of team) {
    teamPPV += await calculatePPV(member.memberId, month);
  }

  return ownPPV + teamPPV;
}

export function monthRange(month?: string): { startStr: string; endStr: string } {
  const now = new Date();
  let year: number, m: number;
  if (month) {
    const parts = month.split('-');
    year = parseInt(parts[0], 10);
    m = parseInt(parts[1], 10) - 1;
  } else {
    year = now.getUTCFullYear();
    m = now.getUTCMonth();
  }
  return {
    startStr: new Date(Date.UTC(year, m, 1)).toISOString(),
    endStr: new Date(Date.UTC(year, m + 1, 1)).toISOString(),
  };
}

/**
 * Determines the highest Active Status Rank a distributor qualifies for
 * given their CGV and PPV this period. Ranks are ordered ascending, so we
 * walk from the top down and return the first one they meet both minimums for.
 */
function resolveActiveStatusRank(
  ranks: ActiveStatusRank[],
  ppv: number,
  cgv: number,
): ActiveStatusRank {
  const sorted = [...ranks].sort((a, b) => b.level_order - a.level_order);
  for (const rank of sorted) {
    if (cgv >= rank.min_cgv && ppv >= rank.min_ppv) {
      return rank;
    }
  }
  return ranks.find((r) => r.level_order === 1) ?? ranks[0];
}

/**
 * Returns a distributor's current PPV, CGV, and resolved active status rank
 * — used for both the live "my rank" screen and the monthly job.
 */
export async function getDistributorCompensationSnapshot(
  distributorId: string,
  month?: string,
): Promise<{ ppv: number; cgv: number; activeStatusRank: ActiveStatusRank; currency: string }> {
  // Get distributor's country to determine currency
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('countries!inner(currency_code)')
    .eq('id', distributorId)
    .single();

  if (profileError || !profile) {
    throw new ApiError(404, 'Distributor profile not found');
  }

  const currency = (profile.countries as any)?.currency_code || 'USD';

  const ranks = await listActiveStatusRanks();
  const ppv = await calculatePPV(distributorId, month);
  const cgv = await calculateCGV(distributorId, month);
  const activeStatusRank = resolveActiveStatusRank(ranks, ppv, cgv);
  return { ppv, cgv, activeStatusRank, currency };
}

async function countQualifiedDownlineLeaders(distributorId: string): Promise<number> {
  const { data: directRecruits, error } = await supabase
    .from('profiles')
    .select('id, is_active, active_status_rank_id')
    .eq('referred_by', distributorId);

  if (error) throw new ApiError(500, `Failed to fetch downline: ${error.message}`);
  if (!directRecruits || directRecruits.length === 0) return 0;

  const { data: lRankRow, error: lRankError } = await supabase
    .from('active_status_ranks')
    .select('level_order')
    .eq('name', 'L')
    .single();

  if (lRankError || !lRankRow) throw new ApiError(500, 'L rank not found in active_status_ranks');
  const lLevelOrder = lRankRow.level_order;

  const rankIds = [...new Set(directRecruits.map((r) => r.active_status_rank_id).filter(Boolean))] as string[];
  if (rankIds.length === 0) return 0;

  const { data: ranks, error: ranksError } = await supabase
    .from('active_status_ranks')
    .select('id, level_order')
    .in('id', rankIds);

  if (ranksError) throw new ApiError(500, `Failed to fetch rank levels: ${ranksError.message}`);

  const levelById = new Map((ranks ?? []).map((r) => [r.id, r.level_order]));

  let count = 0;
  for (const recruit of directRecruits) {
    const rankLevel = recruit.active_status_rank_id ? levelById.get(recruit.active_status_rank_id) ?? 0 : 0;
    if (recruit.is_active && rankLevel >= lLevelOrder) {
      count++;
    }
  }
  return count;
}

/**
 * Resolves the highest leadership rank a distributor qualifies for, based
 * on qualified downline leader count and their own PPV meeting the minimum.
 */
async function resolveLeadershipRank(
  distributorId: string,
  ppv: number,
): Promise<LeadershipRank | null> {
  const ranks = await listLeadershipRanks();
  const qualifiedLeaders = await countQualifiedDownlineLeaders(distributorId);

  const sorted = [...ranks].sort((a, b) => b.level_order - a.level_order);
  for (const rank of sorted) {
    if (qualifiedLeaders >= rank.required_downline_leaders && ppv >= rank.min_ppv) {
      return rank;
    }
  }
  return null;
}

/**
 * OPB (Organisation Performance Bonus) calculation per the spec:
 * Qualified Group Volume = CGV - own PPV
 * Bonus = Qualified Group Volume × active status rank's opb_percent
 */
function calculateOPB(cgv: number, ppv: number, opbPercent: number): number {
  const qualifiedGroupVolume = Math.max(0, cgv - ppv);
  return qualifiedGroupVolume * (opbPercent / 100);
}

/**
 * Runs the daily PPV/CGV calculation for all active distributors
 * This is called by the daily cron job or can be triggered manually via API
 */
export async function runDailyUpdate(): Promise<{ processed: number; timestamp: string }> {
  const { data: distributors, error } = await supabase
    .from('profiles')
    .select('id, distributor_id, full_name')
    .eq('is_active', true);

  if (error) throw new ApiError(500, `Failed to fetch distributors: ${error.message}`);

  const now = new Date();
  const currentMonth = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  
  let updatedCount = 0;
  
  for (const distributor of distributors || []) {
    try {
      const ppv = await calculatePPV(distributor.id, currentMonth);
      const cgv = await calculateCGV(distributor.id, currentMonth);
      updatedCount++;
    } catch (error) {
      console.error(`Failed to calculate PPV/CGV for ${distributor.distributor_id}:`, error);
    }
  }
  
  return {
    processed: updatedCount,
    timestamp: now.toISOString()
  };
}

/**
 * Runs the full monthly requalification job for ALL distributors:
 * - recalculates PPV/CGV
 * - resolves active status rank (auto-demotes if requirements no longer met)
 * - resolves leadership rank
 * - calculates OPB and inserts a 'pending' opb_bonuses row per distributor
 *   with qualified group volume > 0
 * - archives the period's rank snapshot to rank_history
 * Staff-triggered (via endpoint) or by an external cron calling that endpoint.
 */
export async function runMonthlyRequalification(
  period: string,
): Promise<{ processed: number; demoted: number; opbGenerated: number }> {
  const { data: distributors, error } = await supabase
    .from('profiles')
    .select('id, active_status_rank_id')
    .eq('role', 'distributor')
    .eq('is_active', true);

  if (error) throw new ApiError(500, `Failed to fetch distributors: ${error.message}`);

  let processed = 0;
  let demoted = 0;
  let opbGenerated = 0;

  for (const dist of distributors ?? []) {
    try {
      const { ppv, cgv, activeStatusRank } = await getDistributorCompensationSnapshot(dist.id, period);
      const leadershipRank = await resolveLeadershipRank(dist.id, ppv);

      const wasDemoted =
        dist.active_status_rank_id !== null && dist.active_status_rank_id !== activeStatusRank.id;

      await supabase
        .from('profiles')
        .update({
          active_status_rank_id: activeStatusRank.id,
          leadership_rank_id: leadershipRank?.id ?? null,
          current_ppv: ppv,
          current_cgv: cgv,
          last_rank_recalc_at: new Date().toISOString(),
        })
        .eq('id', dist.id);

      await supabase.from('rank_history').upsert(
        {
          distributor_id: dist.id,
          period,
          active_status_rank_id: activeStatusRank.id,
          leadership_rank_id: leadershipRank?.id ?? null,
          ppv,
          cgv,
        },
        { onConflict: 'distributor_id,period' },
      );

      const opbAmount = calculateOPB(cgv, ppv, activeStatusRank.opb_percent);
      if (opbAmount > 0) {
        const { error: opbError } = await supabase.from('opb_bonuses').upsert(
          {
            distributor_id: dist.id,
            period,
            qualified_group_volume: Math.max(0, cgv - ppv),
            opb_percent: activeStatusRank.opb_percent,
            bonus_amount: opbAmount,
            status: 'pending',
          },
          { onConflict: 'distributor_id,period' },
        );
        if (!opbError) opbGenerated++;
      }

      // Generate leadership bonus if qualified
      if (leadershipRank) {
        // Check if leadership bonus already exists for this period
        const { data: existingLeadershipBonus } = await supabase
          .from('leadership_bonuses')
          .select('id')
          .eq('distributor_id', dist.id)
          .eq('period', period)
          .maybeSingle();

        if (!existingLeadershipBonus) {
          // Calculate leadership bonus amount (could be based on rank or fixed amount)
          // For now, using a simple formula based on rank level
          const leadershipBonusAmount = leadershipRank.level_order * 10000; // Example formula

          const { error: leadershipError } = await supabase
            .from('leadership_bonuses')
            .insert({
              distributor_id: dist.id,
              period,
              leadership_rank_id: leadershipRank.id,
              bonus_amount: leadershipBonusAmount,
              status: 'pending',
            });

          if (!leadershipError) {
            console.log(`✅ Leadership bonus generated for ${dist.id}: ${leadershipBonusAmount}`);
          }
        }
      }

      // Generate rank bonus if qualified (above minimum rank)
      if (activeStatusRank.level_order > 1) {
        // Check if rank bonus already exists for this period
        const { data: existingRankBonus } = await supabase
          .from('rank_bonuses')
          .select('id')
          .eq('distributor_id', dist.id)
          .eq('period', period)
          .maybeSingle();

        if (!existingRankBonus) {
          // Calculate rank bonus based on rank level
          const rankBonusAmount = (activeStatusRank.level_order - 1) * 5000; // Example formula

          const { error: rankError } = await supabase
            .from('rank_bonuses')
            .insert({
              distributor_id: dist.id,
              period,
              active_status_rank_id: activeStatusRank.id,
              bonus_amount: rankBonusAmount,
              status: 'pending',
            });

          if (!rankError) {
            console.log(`✅ Rank bonus generated for ${dist.id}: ${rankBonusAmount}`);
          }
        }
      }

      if (wasDemoted) {
        demoted++;
        try {
          await notificationService.createNotification(
            dist.id,
            'system',
            'Rank Updated',
            `Your rank has been updated to ${activeStatusRank.name} based on this month's performance.`,
            { new_rank: activeStatusRank.name },
          );
        } catch {
          // notification failure shouldn't break the job
        }
      }

      processed++;
    } catch (err) {
      console.error(`❌ Failed to process distributor ${dist.id} in monthly requalification: ${err}`);
    }
  }

  return { processed, demoted, opbGenerated };
}

/**
 * Staff approves a pending OPB bonus — credits the wallet the same way
 * manual bonuses do. Staff only.
 */
export async function approveOPBBonus(opbId: string, staffId: string): Promise<void> {
  const { data: opb, error: fetchError } = await supabase
    .from('opb_bonuses')
    .select('*')
    .eq('id', opbId)
    .single();

  if (fetchError || !opb) throw new ApiError(404, 'OPB bonus not found');
  if (opb.status !== 'pending') throw new ApiError(422, 'OPB bonus is not pending');

  const { error: updateError } = await supabase
    .from('opb_bonuses')
    .update({ status: 'approved', approved_by: staffId, approved_at: new Date().toISOString() })
    .eq('id', opbId);

  if (updateError) throw new ApiError(500, `Failed to approve OPB bonus: ${updateError.message}`);

  // Credit wallet directly — mirrors the manual_bonuses trigger pattern
  const { data: wallet } = await supabase
    .from('wallets')
    .select('balance')
    .eq('distributor_id', opb.distributor_id)
    .maybeSingle();

  const currentBalance = Number(wallet?.balance ?? 0);
  const newBalance = currentBalance + Number(opb.bonus_amount);

  await supabase
    .from('wallets')
    .upsert({ distributor_id: opb.distributor_id, balance: newBalance }, { onConflict: 'distributor_id' });

  await supabase.from('wallet_transactions').insert({
    distributor_id: opb.distributor_id,
    type: 'credit',
    source_type: 'opb_bonus',
    source_id: opb.id,
    amount: opb.bonus_amount,
    balance_after: newBalance,
  });

  try {
    await notificationService.createNotification(
      opb.distributor_id,
      'system',
      'OPB Bonus Paid',
      `Your Organisation Performance Bonus of ${Number(opb.bonus_amount).toFixed(2)} for ${opb.period} has been paid.`,
      { period: opb.period, amount: opb.bonus_amount },
    );
  } catch {
    // ignore
  }
}

export async function rejectOPBBonus(opbId: string, staffId: string): Promise<void> {
  const { error } = await supabase
    .from('opb_bonuses')
    .update({ status: 'rejected', approved_by: staffId, approved_at: new Date().toISOString() })
    .eq('id', opbId)
    .eq('status', 'pending');

  if (error) throw new ApiError(500, `Failed to reject OPB bonus: ${error.message}`);
}

export async function listPendingOPBBonuses(): Promise<any[]> {
  const { data, error } = await supabase
    .from('opb_bonuses')
    .select(`
      *,
      profiles!opb_bonuses_distributor_id_fkey (
        full_name,
        distributor_id,
        countries ( currency_code )
      )
    `)
    .eq('status', 'pending')
    .order('created_at', { ascending: true });

  if (error) throw new ApiError(500, `Failed to fetch pending OPB bonuses: ${error.message}`);

  return (data ?? []).map((row: any) => ({
    ...row,
    currencyCode: row.profiles?.countries?.currency_code || 'TZS',
  }));
}

/**
 * Lists all pending commissions (referral/direct, team bonus) for staff review
 */
export async function listPendingCommissions(): Promise<any[]> {
  const { data, error } = await supabase
    .from('commissions')
    .select(`
      *,
      profiles!commissions_beneficiary_id_fkey (
        full_name,
        distributor_id,
        countries ( currency_code )
      ),
      sales (
        id,
        amount,
        order_id
      )
    `)
    .eq('status', 'pending')
    .order('created_at', { ascending: true });

  if (error) throw new ApiError(500, `Failed to fetch pending commissions: ${error.message}`);

  return (data ?? []).map((row: any) => ({
    ...row,
    currencyCode: row.profiles?.countries?.currency_code || 'TZS',
  }));
}

/**
 * Approves a pending commission and credits the wallet
 */
export async function approveCommission(commissionId: string, staffId: string): Promise<void> {
  const { data: commission, error: fetchError } = await supabase
    .from('commissions')
    .select('*')
    .eq('id', commissionId)
    .single();

  if (fetchError || !commission) throw new ApiError(404, 'Commission not found');
  if (commission.status !== 'pending') throw new ApiError(422, 'Commission is not pending');

  const { error: updateError } = await supabase
    .from('commissions')
    .update({ 
      status: 'approved', 
      approved_by: staffId, 
      approved_at: new Date().toISOString() 
    })
    .eq('id', commissionId);

  if (updateError) throw new ApiError(500, `Failed to approve commission: ${updateError.message}`);

  // Credit wallet
  const { data: wallet } = await supabase
    .from('wallets')
    .select('balance')
    .eq('distributor_id', commission.beneficiary_id)
    .maybeSingle();

  const currentBalance = Number(wallet?.balance ?? 0);
  const newBalance = currentBalance + Number(commission.amount);

  await supabase
    .from('wallets')
    .upsert({ distributor_id: commission.beneficiary_id, balance: newBalance }, { onConflict: 'distributor_id' });

  await supabase.from('wallet_transactions').insert({
    distributor_id: commission.beneficiary_id,
    type: 'credit',
    source_type: commission.bonus_type === 'team_bonus' ? 'team_bonus' : 'commission',
    source_id: commission.id,
    amount: commission.amount,
    balance_after: newBalance,
  });

  // Send notification
  try {
    const bonusType = commission.bonus_type === 'team_bonus' ? 'Team Bonus' : 'Referral Commission';
    await notificationService.createNotification(
      commission.beneficiary_id,
      'system',
      `${bonusType} Approved`,
      `Your ${bonusType.toLowerCase()} of ${Number(commission.amount).toFixed(2)} has been approved and credited to your wallet.`,
      { amount: commission.amount, type: commission.bonus_type },
    );
  } catch {
    // ignore notification errors
  }
}

/**
 * Rejects a pending commission
 */
export async function rejectCommission(commissionId: string, staffId: string): Promise<void> {
  const { error } = await supabase
    .from('commissions')
    .update({ 
      status: 'rejected', 
      approved_by: staffId, 
      approved_at: new Date().toISOString() 
    })
    .eq('id', commissionId)
    .eq('status', 'pending');

  if (error) throw new ApiError(500, `Failed to reject commission: ${error.message}`);
}

/**
 * Lists pending leadership bonuses
 */
export async function listPendingLeadershipBonuses(): Promise<any[]> {
  const { data, error } = await supabase
    .from('leadership_bonuses')
    .select(`*, profiles!leadership_bonuses_distributor_id_fkey ( full_name, distributor_id )`)
    .eq('status', 'pending')
    .order('created_at', { ascending: true });

  if (error) throw new ApiError(500, `Failed to fetch pending leadership bonuses: ${error.message}`);
  return data ?? [];
}

/**
 * Approves a pending leadership bonus
 */
export async function approveLeadershipBonus(bonusId: string, staffId: string): Promise<void> {
  const { data: bonus, error: fetchError } = await supabase
    .from('leadership_bonuses')
    .select('*')
    .eq('id', bonusId)
    .single();

  if (fetchError || !bonus) throw new ApiError(404, 'Leadership bonus not found');
  if (bonus.status !== 'pending') throw new ApiError(422, 'Leadership bonus is not pending');

  const { error: updateError } = await supabase
    .from('leadership_bonuses')
    .update({ status: 'approved', approved_by: staffId, approved_at: new Date().toISOString() })
    .eq('id', bonusId);

  if (updateError) throw new ApiError(500, `Failed to approve leadership bonus: ${updateError.message}`);

  // Credit wallet
  const { data: wallet } = await supabase
    .from('wallets')
    .select('balance')
    .eq('distributor_id', bonus.distributor_id)
    .maybeSingle();

  const currentBalance = Number(wallet?.balance ?? 0);
  const newBalance = currentBalance + Number(bonus.bonus_amount);

  await supabase
    .from('wallets')
    .upsert({ distributor_id: bonus.distributor_id, balance: newBalance }, { onConflict: 'distributor_id' });

  await supabase.from('wallet_transactions').insert({
    distributor_id: bonus.distributor_id,
    type: 'credit',
    source_type: 'leadership_bonus',
    source_id: bonus.id,
    amount: bonus.bonus_amount,
    balance_after: newBalance,
  });

  try {
    await notificationService.createNotification(
      bonus.distributor_id,
      'system',
      'Leadership Bonus Paid',
      `Your Leadership Bonus of ${Number(bonus.bonus_amount).toFixed(2)} for ${bonus.period} has been paid.`,
      { period: bonus.period, amount: bonus.bonus_amount },
    );
  } catch {
    // ignore notification errors
  }
}

/**
 * Rejects a pending leadership bonus
 */
export async function rejectLeadershipBonus(bonusId: string, staffId: string): Promise<void> {
  const { error } = await supabase
    .from('leadership_bonuses')
    .update({ status: 'rejected', approved_by: staffId, approved_at: new Date().toISOString() })
    .eq('id', bonusId)
    .eq('status', 'pending');

  if (error) throw new ApiError(500, `Failed to reject leadership bonus: ${error.message}`);
}

/**
 * Lists pending rank bonuses
 */
export async function listPendingRankBonuses(): Promise<any[]> {
  const { data, error } = await supabase
    .from('rank_bonuses')
    .select(`*, profiles!rank_bonuses_distributor_id_fkey ( full_name, distributor_id )`)
    .eq('status', 'pending')
    .order('created_at', { ascending: true });

  if (error) throw new ApiError(500, `Failed to fetch pending rank bonuses: ${error.message}`);
  return data ?? [];
}

/**
 * Approves a pending rank bonus
 */
export async function approveRankBonus(bonusId: string, staffId: string): Promise<void> {
  const { data: bonus, error: fetchError } = await supabase
    .from('rank_bonuses')
    .select('*')
    .eq('id', bonusId)
    .single();

  if (fetchError || !bonus) throw new ApiError(404, 'Rank bonus not found');
  if (bonus.status !== 'pending') throw new ApiError(422, 'Rank bonus is not pending');

  const { error: updateError } = await supabase
    .from('rank_bonuses')
    .update({ status: 'approved', approved_by: staffId, approved_at: new Date().toISOString() })
    .eq('id', bonusId);

  if (updateError) throw new ApiError(500, `Failed to approve rank bonus: ${updateError.message}`);

  // Credit wallet
  const { data: wallet } = await supabase
    .from('wallets')
    .select('balance')
    .eq('distributor_id', bonus.distributor_id)
    .maybeSingle();

  const currentBalance = Number(wallet?.balance ?? 0);
  const newBalance = currentBalance + Number(bonus.bonus_amount);

  await supabase
    .from('wallets')
    .upsert({ distributor_id: bonus.distributor_id, balance: newBalance }, { onConflict: 'distributor_id' });

  await supabase.from('wallet_transactions').insert({
    distributor_id: bonus.distributor_id,
    type: 'credit',
    source_type: 'rank_bonus',
    source_id: bonus.id,
    amount: bonus.bonus_amount,
    balance_after: newBalance,
  });

  try {
    await notificationService.createNotification(
      bonus.distributor_id,
      'system',
      'Rank Bonus Paid',
      `Your Rank Bonus of ${Number(bonus.bonus_amount).toFixed(2)} for ${bonus.period} has been paid.`,
      { period: bonus.period, amount: bonus.bonus_amount },
    );
  } catch {
    // ignore notification errors
  }
}

/**
 * Rejects a pending rank bonus
 */
export async function rejectRankBonus(bonusId: string, staffId: string): Promise<void> {
  const { error } = await supabase
    .from('rank_bonuses')
    .update({ status: 'rejected', approved_by: staffId, approved_at: new Date().toISOString() })
    .eq('id', bonusId)
    .eq('status', 'pending');

  if (error) throw new ApiError(500, `Failed to reject rank bonus: ${error.message}`);
}