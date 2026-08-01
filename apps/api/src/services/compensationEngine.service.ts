/**
 * THEONUTRA V1 Compensation Engine
 * PPV (monthly personal) → GPV (monthly team) → Lifetime CGV → Star ranks
 * Active Monthly Bonus + Differential Commission (PV → USD → TZS)
 */
import { supabase } from '../config/supabase.js';
import { ApiError } from '../middleware/error.middleware.js';
import * as notificationService from './notification.service.js';

export type LegPosition = 'left' | 'center' | 'right';

export interface StarRank {
  id: string;
  code: string;
  name: string;
  level_order: number;
  min_ppv: number;
  min_cgv: number;
  bonus_percent: number;
}

export interface CompensationSnapshotV1 {
  period: string;
  ppv: number;
  gpv: number;
  lifetimeCgv: number;
  isActive: boolean;
  currentRank: StarRank | null;
  nextRank: StarRank | null;
  ppvRequired: number;
  cgvRequired: number;
  ppvNeeded: number;
  cgvNeeded: number;
  legs: {
    left: { memberId: string | null; fullName: string | null; ppv: number };
    center: { memberId: string | null; fullName: string | null; ppv: number };
    right: { memberId: string | null; fullName: string | null; ppv: number };
  };
  currency: string;
}

export interface NetworkBonusRow {
  id: string;
  distributor_id: string;
  source_distributor_id: string | null;
  bonus_type: 'active_monthly' | 'differential';
  period: string;
  bonus_pv: number;
  bonus_usd: number;
  exchange_rate: number;
  amount_tzs: number;
  status: string;
  created_at: string;
  profiles?: { full_name: string; distributor_id: string } | null;
}

const LEGS: LegPosition[] = ['left', 'center', 'right'];

function periodBounds(period?: string): { period: string; startIso: string; endIso: string } {
  const now = new Date();
  let year: number;
  let monthIndex: number;
  if (period) {
    const [y, m] = period.split('-').map(Number);
    year = y;
    monthIndex = m - 1;
  } else {
    year = now.getUTCFullYear();
    monthIndex = now.getUTCMonth();
  }
  const p = `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
  return {
    period: p,
    startIso: new Date(Date.UTC(year, monthIndex, 1)).toISOString(),
    endIso: new Date(Date.UTC(year, monthIndex + 1, 1)).toISOString(),
  };
}

export async function listStarRanks(): Promise<StarRank[]> {
  const { data, error } = await supabase
    .from('star_ranks')
    .select('*')
    .order('level_order', { ascending: true });
  if (error) throw new ApiError(500, `Failed to fetch star ranks: ${error.message}`);
  return (data ?? []).map(mapStarRank);
}

function mapStarRank(r: any): StarRank {
  return {
    id: r.id,
    code: r.code,
    name: r.name,
    level_order: Number(r.level_order),
    min_ppv: Number(r.min_ppv),
    min_cgv: Number(r.min_cgv),
    bonus_percent: Number(r.bonus_percent),
  };
}

export async function getCompensationSettings(): Promise<{ usdPerPv: number; usdTzsRate: number }> {
  const { data, error } = await supabase
    .from('compensation_settings')
    .select('usd_per_pv, usd_tzs_rate')
    .eq('id', 1)
    .maybeSingle();
  if (error) throw new ApiError(500, `Failed to fetch compensation settings: ${error.message}`);
  return {
    usdPerPv: Number(data?.usd_per_pv ?? 1),
    usdTzsRate: Number(data?.usd_tzs_rate ?? 2500),
  };
}

/** Personal Point Value for a month (qty × product PV). */
export async function calculatePPV(distributorId: string, period?: string): Promise<number> {
  const { startIso, endIso } = periodBounds(period);

  const { data: orders, error: ordersError } = await supabase
    .from('orders')
    .select(`id, order_items!inner ( quantity, products!inner ( pv ) )`)
    .eq('buyer_id', distributorId)
    .eq('status', 'paid')
    .gte('created_at', startIso)
    .lt('created_at', endIso);

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
    .gte('created_at', startIso)
    .lt('created_at', endIso);

  if (salesError) throw new ApiError(500, `Failed to calculate PPV from customer sales: ${salesError.message}`);

  for (const sale of sales ?? []) {
    for (const item of (sale.customer_sale_items as any[]) ?? []) {
      ppv += Number(item.quantity) * Number(item.pv_at_sale ?? 0);
    }
  }

  return ppv;
}

async function getDownlineMemberIds(rootId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('downline_tree')
    .select('member_id')
    .eq('root_id', rootId);
  if (error) throw new ApiError(500, `Failed to fetch downline: ${error.message}`);
  return (data ?? []).map((r) => r.member_id as string);
}

/** Group Point Value = sum of downline PPV this month (excludes self). */
export async function calculateGPV(distributorId: string, period?: string): Promise<number> {
  const memberIds = await getDownlineMemberIds(distributorId);
  let gpv = 0;
  for (const memberId of memberIds) {
    gpv += await calculatePPV(memberId, period);
  }
  return gpv;
}

/**
 * Lifetime CGV = stored counter, or sum of all monthly (ppv+gpv) rows + current period.
 * Prefer profile.lifetime_cgv which is maintained by the monthly job.
 */
export async function getLifetimeCGV(distributorId: string): Promise<number> {
  const { data, error } = await supabase
    .from('profiles')
    .select('lifetime_cgv')
    .eq('id', distributorId)
    .single();
  if (error) throw new ApiError(500, `Failed to fetch lifetime CGV: ${error.message}`);
  return Number(data?.lifetime_cgv ?? 0);
}

/** Highest star rank where PPV and lifetime CGV both meet thresholds. */
export function resolveStarRank(ranks: StarRank[], ppv: number, lifetimeCgv: number): StarRank | null {
  let matched: StarRank | null = null;
  for (const rank of ranks) {
    if (ppv >= rank.min_ppv && lifetimeCgv >= rank.min_cgv) {
      matched = rank;
    }
  }
  return matched;
}

export function isRankActive(rank: StarRank | null, ppv: number): boolean {
  if (!rank) return false;
  return ppv >= rank.min_ppv;
}

function convertBonusPv(bonusPv: number, usdPerPv: number, usdTzsRate: number) {
  const bonusUsd = bonusPv * usdPerPv;
  const amountTzs = bonusUsd * usdTzsRate;
  return { bonusUsd, amountTzs, exchangeRate: usdTzsRate };
}

/**
 * Assign Left/Center/Right under sponsor; spillover to weakest leg if full.
 */
export async function assignPlacement(referredById: string): Promise<{
  placementSponsorId: string;
  legPosition: LegPosition;
}> {
  const { data: directs, error } = await supabase
    .from('profiles')
    .select('id, leg_position')
    .eq('placement_sponsor_id', referredById)
    .in('leg_position', LEGS);

  if (error) throw new ApiError(500, `Failed to fetch legs: ${error.message}`);

  const taken = new Set(
    (directs ?? []).map((d) => d.leg_position as LegPosition).filter(Boolean),
  );

  for (const leg of LEGS) {
    if (!taken.has(leg)) {
      return { placementSponsorId: referredById, legPosition: leg };
    }
  }

  // All 3 legs filled — spillover under weakest (lowest current-month PPV of the leg root)
  const period = periodBounds().period;
  let weakestId = (directs ?? [])[0]?.id as string;
  let weakestPpv = Number.POSITIVE_INFINITY;

  for (const d of directs ?? []) {
    const legRootId = d.id as string;
    // Leg strength = PPV of leg root + its entire downline (approx monthly GPV from sponsor's view for that branch)
    const branchPpv = (await calculatePPV(legRootId, period)) + (await calculateGPV(legRootId, period));
    if (branchPpv < weakestPpv) {
      weakestPpv = branchPpv;
      weakestId = legRootId;
    }
  }

  return assignPlacement(weakestId);
}

export async function applyPlacementToProfile(
  userId: string,
  referredById: string | null,
): Promise<void> {
  if (!referredById) return;
  const placement = await assignPlacement(referredById);
  const { error } = await supabase
    .from('profiles')
    .update({
      placement_sponsor_id: placement.placementSponsorId,
      leg_position: placement.legPosition,
      referred_by: referredById,
    })
    .eq('id', userId);
  if (error) throw new ApiError(500, `Failed to apply placement: ${error.message}`);
}

async function getDirectLegs(distributorId: string, period: string) {
  const empty = { memberId: null as string | null, fullName: null as string | null, ppv: 0 };
  const result = { left: { ...empty }, center: { ...empty }, right: { ...empty } };

  const { data: directs } = await supabase
    .from('profiles')
    .select('id, full_name, leg_position')
    .eq('placement_sponsor_id', distributorId)
    .in('leg_position', LEGS);

  for (const d of directs ?? []) {
    const leg = d.leg_position as LegPosition;
    if (!LEGS.includes(leg)) continue;
    const ppv = await calculatePPV(d.id, period);
    result[leg] = { memberId: d.id, fullName: d.full_name, ppv };
  }
  return result;
}

export async function getMyCompensationSnapshotV1(
  distributorId: string,
  month?: string,
): Promise<CompensationSnapshotV1> {
  const { period } = periodBounds(month);
  const ranks = await listStarRanks();
  const ppv = await calculatePPV(distributorId, period);
  const gpv = await calculateGPV(distributorId, period);
  const lifetimeCgv = await getLifetimeCGV(distributorId);

  const { data: profile } = await supabase
    .from('profiles')
    .select('star_rank_id, countries(currency_code)')
    .eq('id', distributorId)
    .single();

  const currency = (profile as any)?.countries?.currency_code || 'TZS';
  let currentRank =
    ranks.find((r) => r.id === profile?.star_rank_id) ??
    resolveStarRank(ranks, ppv, lifetimeCgv);

  // Prefer stored rank; still compute eligibility for next
  const resolved = resolveStarRank(ranks, ppv, lifetimeCgv);
  if (resolved && (!currentRank || resolved.level_order > currentRank.level_order)) {
    currentRank = resolved;
  }

  const nextRank =
    ranks.find((r) => r.level_order === (currentRank?.level_order ?? 0) + 1) ?? null;

  const ppvRequired = currentRank?.min_ppv ?? ranks[0]?.min_ppv ?? 0;
  const cgvRequired = nextRank?.min_cgv ?? currentRank?.min_cgv ?? 0;

  return {
    period,
    ppv,
    gpv,
    lifetimeCgv,
    isActive: isRankActive(currentRank, ppv),
    currentRank,
    nextRank,
    ppvRequired,
    cgvRequired,
    ppvNeeded: Math.max(0, ppvRequired - ppv),
    cgvNeeded: Math.max(0, (nextRank?.min_cgv ?? 0) - lifetimeCgv),
    legs: await getDirectLegs(distributorId, period),
    currency,
  };
}

/**
 * Upsert monthly volume, bump lifetime CGV by this period's (ppv+gpv) delta,
 * promote star rank (never demote), generate network bonuses for ACTIVE members.
 */
export async function runMonthlyCompensationJob(
  period: string,
): Promise<{ processed: number; promoted: number; bonusesCreated: number }> {
  const ranks = await listStarRanks();
  const settings = await getCompensationSettings();
  const { data: distributors, error } = await supabase
    .from('profiles')
    .select('id, star_rank_id, lifetime_cgv')
    .eq('role', 'distributor')
    .eq('is_active', true);

  if (error) throw new ApiError(500, `Failed to fetch distributors: ${error.message}`);

  let processed = 0;
  let promoted = 0;
  let bonusesCreated = 0;

  // First pass: compute and store volumes + promote ranks
  const snapshots = new Map<
    string,
    { ppv: number; gpv: number; lifetimeCgv: number; rank: StarRank | null; active: boolean }
  >();

  for (const dist of distributors ?? []) {
    const ppv = await calculatePPV(dist.id, period);
    const gpv = await calculateGPV(dist.id, period);

    // Avoid double-counting lifetime if job re-run: read existing monthly row
    const { data: existingVol } = await supabase
      .from('distributor_volume_monthly')
      .select('ppv, gpv')
      .eq('distributor_id', dist.id)
      .eq('period', period)
      .maybeSingle();

    const prevContribution = existingVol
      ? Number(existingVol.ppv) + Number(existingVol.gpv)
      : 0;
    const newContribution = ppv + gpv;
    const delta = newContribution - prevContribution;
    const lifetimeCgv = Number(dist.lifetime_cgv ?? 0) + delta;

    const resolved = resolveStarRank(ranks, ppv, lifetimeCgv);
    const previousRank = ranks.find((r) => r.id === dist.star_rank_id) ?? null;
    const active = isRankActive(resolved, ppv);

    await supabase.from('distributor_volume_monthly').upsert(
      {
        distributor_id: dist.id,
        period,
        ppv,
        gpv,
        is_active: active,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'distributor_id,period' },
    );

    const patch: Record<string, unknown> = { lifetime_cgv: lifetimeCgv };
    if (resolved && (!previousRank || resolved.level_order >= previousRank.level_order)) {
      patch.star_rank_id = resolved.id;
      if (!previousRank || resolved.level_order > previousRank.level_order) {
        promoted++;
        try {
          await notificationService.createNotification(
            dist.id,
            'system',
            `Rank Upgraded: ${resolved.name}`,
            `Congratulations! You reached ${resolved.name}. Dashboard updated.`,
            { rank: resolved.code, period },
          );
        } catch {
          /* ignore */
        }
      }
    }

    await supabase.from('profiles').update(patch).eq('id', dist.id);

    snapshots.set(dist.id, {
      ppv,
      gpv,
      lifetimeCgv,
      rank: resolved ?? previousRank,
      active,
    });
    processed++;
  }

  // Second pass: generate bonuses (needs all ranks/PPV known)
  for (const [distId, snap] of snapshots) {
    if (!snap.active || !snap.rank) continue;

    // Active monthly bonus = rank% × own PPV
    const ambPv = snap.ppv * (snap.rank.bonus_percent / 100);
    if (ambPv > 0) {
      const { bonusUsd, amountTzs, exchangeRate } = convertBonusPv(
        ambPv,
        settings.usdPerPv,
        settings.usdTzsRate,
      );
      const created = await upsertNetworkBonus({
        distributorId: distId,
        sourceDistributorId: distId,
        bonusType: 'active_monthly',
        period,
        bonusPv: ambPv,
        bonusUsd,
        exchangeRate,
        amountTzs,
      });
      if (created) bonusesCreated++;
    }

    // Differential: for each downline member, (my% − their%) × their PPV if > 0
    const downlineIds = await getDownlineMemberIds(distId);
    for (const memberId of downlineIds) {
      const memberSnap = snapshots.get(memberId);
      if (!memberSnap || memberSnap.ppv <= 0) continue;
      const memberPct = memberSnap.rank?.bonus_percent ?? 0;
      const diffPct = snap.rank.bonus_percent - memberPct;
      if (diffPct <= 0) continue;
      // Upline must be Active (already checked); downline need not be active for volume
      const diffPv = memberSnap.ppv * (diffPct / 100);
      const { bonusUsd, amountTzs, exchangeRate } = convertBonusPv(
        diffPv,
        settings.usdPerPv,
        settings.usdTzsRate,
      );
      const created = await upsertNetworkBonus({
        distributorId: distId,
        sourceDistributorId: memberId,
        bonusType: 'differential',
        period,
        bonusPv: diffPv,
        bonusUsd,
        exchangeRate,
        amountTzs,
      });
      if (created) bonusesCreated++;
    }
  }

  return { processed, promoted, bonusesCreated };
}

async function upsertNetworkBonus(input: {
  distributorId: string;
  sourceDistributorId: string;
  bonusType: 'active_monthly' | 'differential';
  period: string;
  bonusPv: number;
  bonusUsd: number;
  exchangeRate: number;
  amountTzs: number;
}): Promise<boolean> {
  // Idempotent: skip if already exists for same key
  let query = supabase
    .from('network_bonuses')
    .select('id, status')
    .eq('distributor_id', input.distributorId)
    .eq('bonus_type', input.bonusType)
    .eq('period', input.period)
    .eq('source_distributor_id', input.sourceDistributorId);

  const { data: existing } = await query.maybeSingle();
  if (existing) {
    if (existing.status !== 'pending') return false;
    await supabase
      .from('network_bonuses')
      .update({
        bonus_pv: input.bonusPv,
        bonus_usd: input.bonusUsd,
        exchange_rate: input.exchangeRate,
        amount_tzs: input.amountTzs,
      })
      .eq('id', existing.id);
    return false;
  }

  const { error } = await supabase.from('network_bonuses').insert({
    distributor_id: input.distributorId,
    source_distributor_id: input.sourceDistributorId,
    bonus_type: input.bonusType,
    period: input.period,
    bonus_pv: input.bonusPv,
    bonus_usd: input.bonusUsd,
    exchange_rate: input.exchangeRate,
    amount_tzs: input.amountTzs,
    status: 'pending',
  });
  if (error) {
    console.error(`Failed to insert network bonus: ${error.message}`);
    return false;
  }
  return true;
}

export async function listPendingNetworkBonuses(): Promise<NetworkBonusRow[]> {
  const { data, error } = await supabase
    .from('network_bonuses')
    .select(`
      *,
      profiles!network_bonuses_distributor_id_fkey ( full_name, distributor_id )
    `)
    .eq('status', 'pending')
    .order('created_at', { ascending: true });
  if (error) throw new ApiError(500, `Failed to list pending network bonuses: ${error.message}`);
  return (data ?? []) as NetworkBonusRow[];
}

export async function approveNetworkBonus(bonusId: string, staffId: string): Promise<void> {
  const { data: bonus, error: fetchError } = await supabase
    .from('network_bonuses')
    .select('*')
    .eq('id', bonusId)
    .single();
  if (fetchError || !bonus) throw new ApiError(404, 'Network bonus not found');
  if (bonus.status !== 'pending') throw new ApiError(422, 'Bonus is not pending');

  const { error: updateError } = await supabase
    .from('network_bonuses')
    .update({
      status: 'approved',
      approved_by: staffId,
      approved_at: new Date().toISOString(),
    })
    .eq('id', bonusId);
  if (updateError) throw new ApiError(500, `Failed to approve bonus: ${updateError.message}`);

  const amount = Number(bonus.amount_tzs);
  const { data: wallet } = await supabase
    .from('wallets')
    .select('balance')
    .eq('distributor_id', bonus.distributor_id)
    .maybeSingle();

  const newBalance = Number(wallet?.balance ?? 0) + amount;
  await supabase
    .from('wallets')
    .upsert({ distributor_id: bonus.distributor_id, balance: newBalance }, { onConflict: 'distributor_id' });

  await supabase.from('wallet_transactions').insert({
    distributor_id: bonus.distributor_id,
    type: 'credit',
    source_type: 'commission',
    source_id: bonus.id,
    amount,
    balance_after: newBalance,
    description: `${bonus.bonus_type} ${bonus.period} (${bonus.bonus_pv} PV)`,
  });

  try {
    await notificationService.createNotification(
      bonus.distributor_id,
      'commission_earned',
      'Network Bonus Approved',
      `Your ${bonus.bonus_type.replace('_', ' ')} of ${amount.toFixed(0)} TZS (${bonus.bonus_pv} PV) was approved.`,
      { bonusId, amount, bonusPv: bonus.bonus_pv },
    );
  } catch {
    /* ignore */
  }
}

export async function rejectNetworkBonus(bonusId: string, staffId: string): Promise<void> {
  const { error } = await supabase
    .from('network_bonuses')
    .update({
      status: 'rejected',
      approved_by: staffId,
      approved_at: new Date().toISOString(),
    })
    .eq('id', bonusId)
    .eq('status', 'pending');
  if (error) throw new ApiError(500, `Failed to reject bonus: ${error.message}`);
}

/**
 * Month-end payout batch: marks approved network bonuses as paid using
 * each distributor's confirmed payment method (record for staff execution).
 */
export async function runPayoutBatch(
  period: string,
  staffId: string,
): Promise<{ paidCount: number; totalTzs: number; skipped: number }> {
  const { data: bonuses, error } = await supabase
    .from('network_bonuses')
    .select('*')
    .eq('status', 'approved')
    .eq('period', period);

  if (error) throw new ApiError(500, `Failed to fetch approved bonuses: ${error.message}`);

  let paidCount = 0;
  let totalTzs = 0;
  let skipped = 0;

  for (const bonus of bonuses ?? []) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('payment_method, payment_full_name, payment_account_number, full_name')
      .eq('id', bonus.distributor_id)
      .single();

    if (!profile?.payment_account_number || !profile?.payment_method) {
      skipped++;
      continue;
    }

    const { error: updErr } = await supabase
      .from('network_bonuses')
      .update({ status: 'paid', paid_at: new Date().toISOString() })
      .eq('id', bonus.id)
      .eq('status', 'approved');

    if (updErr) {
      skipped++;
      continue;
    }

    paidCount++;
    totalTzs += Number(bonus.amount_tzs);

    try {
      await notificationService.createNotification(
        bonus.distributor_id,
        'system',
        'Payout Processed',
        `Your network bonus of ${Number(bonus.amount_tzs).toFixed(0)} TZS for ${period} is being paid to ${profile.payment_method} ${profile.payment_account_number}.`,
        {
          period,
          amountTzs: bonus.amount_tzs,
          paymentMethod: profile.payment_method,
          account: profile.payment_account_number,
        },
      );
    } catch {
      /* ignore */
    }
  }

  await supabase.from('payout_batches').insert({
    period,
    run_by: staffId,
    paid_count: paidCount,
    total_tzs: totalTzs,
  });

  return { paidCount, totalTzs, skipped };
}
