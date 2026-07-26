//rankServices
import { supabase } from '../config/supabase.js';
import { ApiError } from '../middleware/error.middleware.js';
import { getMyTeam } from './team.service.js';

export interface Rank {
  id: string;
  name: string;
  level_order: number;
  personal_pv_required: number;
  team_pv_required: number;
  description: string | null;
  reward_description: string | null;
  created_at: string;
}

export interface MyRankResponse {
  currentRank: Rank | null;
  personalPV: number;
  teamPV: number;
}

export interface RankProgressResponse {
  currentRank: Rank | null;
  personalPV: number;
  teamPV: number;
  nextRank: Rank | null;
  personalPVNeeded: number;
  teamPVNeeded: number;
}

/**
 * Returns all ranks ordered by level_order
 */
export async function listRanks(): Promise<Rank[]> {
  const { data, error } = await supabase
    .from('ranks')
    .select('*')
    .order('level_order', { ascending: true });

  if (error) {
    throw new ApiError(500, `Failed to fetch ranks: ${error.message}`);
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    level_order: row.level_order,
    personal_pv_required: Number(row.personal_pv_required ?? 0),
    team_pv_required: Number(row.team_pv_required ?? 0),
    description: row.description ?? null,
    reward_description: row.reward_description ?? null,
    created_at: row.created_at,
  }));
}

/**
 * Calculates personal PV for the given distributor during the specified month
 * Sums PV from both order_items (paid orders) and customer_sale_items (retail sales)
 */
export async function getPersonalPV(distributorId: string, month?: string): Promise<number> {
  const now = new Date();
  let startStr: string;
  let endStr: string;

  if (month) {
    const parts = month.split('-');
    const year = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1;
    startStr = new Date(Date.UTC(year, m, 1)).toISOString();
    endStr = new Date(Date.UTC(year, m + 1, 1)).toISOString();
  } else {
    const year = now.getUTCFullYear();
    const m = now.getUTCMonth();
    startStr = new Date(Date.UTC(year, m, 1)).toISOString();
    endStr = new Date(Date.UTC(year, m + 1, 1)).toISOString();
  }

  // 1. Get PV from paid orders
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
    .eq('buyer_id', distributorId)
    .eq('status', 'paid')
    .gte('created_at', startStr)
    .lt('created_at', endStr);

  if (ordersError) {
    throw new ApiError(500, `Failed to calculate personal PV from orders: ${ordersError.message}`);
  }

  let totalPV = 0;
  for (const order of orders ?? []) {
    const items = order.order_items as any[];
    for (const item of items ?? []) {
      totalPV += Number(item.quantity) * Number(item.products?.pv ?? 0);
    }
  }

  // 2. Get PV from customer sales
  const { data: customerSales, error: salesError } = await supabase
    .from('customer_sales')
    .select(`
      id,
      customer_sale_items!inner (
        quantity,
        pv_at_sale
      )
    `)
    .eq('distributor_id', distributorId)
    .gte('created_at', startStr)
    .lt('created_at', endStr);

  if (salesError) {
    throw new ApiError(500, `Failed to calculate personal PV from customer sales: ${salesError.message}`);
  }

  for (const sale of customerSales ?? []) {
    const items = sale.customer_sale_items as any[];
    for (const item of items ?? []) {
      totalPV += Number(item.quantity) * Number(item.pv_at_sale ?? 0);
    }
  }

  return totalPV;
}

/**
 * Calculates team PV for the given distributor's downline during the specified month
 */
export async function getTeamPV(distributorId: string, month?: string): Promise<number> {
  const teamMembers = await getMyTeam(distributorId);
  if (teamMembers.length === 0) {
    return 0;
  }

  const memberIds = teamMembers.map((m) => m.memberId);

  const now = new Date();
  let startStr: string;
  let endStr: string;

  if (month) {
    const parts = month.split('-');
    const year = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1;
    startStr = new Date(Date.UTC(year, m, 1)).toISOString();
    endStr = new Date(Date.UTC(year, m + 1, 1)).toISOString();
  } else {
    const year = now.getUTCFullYear();
    const m = now.getUTCMonth();
    startStr = new Date(Date.UTC(year, m, 1)).toISOString();
    endStr = new Date(Date.UTC(year, m + 1, 1)).toISOString();
  }

  const { data, error } = await supabase
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
    .in('buyer_id', memberIds)
    .eq('status', 'paid')
    .gte('created_at', startStr)
    .lt('created_at', endStr);

  if (error) {
    throw new ApiError(500, `Failed to calculate team PV: ${error.message}`);
  }

  let totalPV = 0;
  for (const order of data ?? []) {
    const items = order.order_items as any[];
    for (const item of items ?? []) {
      totalPV += Number(item.quantity) * Number(item.products?.pv ?? 0);
    }
  }

  return totalPV;
}

/**
 * Returns the distributor's current rank along with their personal/team PV progress
 */
export async function getMyRank(distributorId: string): Promise<MyRankResponse> {
  const { data: profile, error } = await supabase
    .from('profiles')
    .select(`
      rank_id,
      ranks (
        id,
        name,
        level_order,
        personal_pv_required,
        team_pv_required,
        description,
        reward_description,
        created_at
      )
    `)
    .eq('id', distributorId)
    .single();

  if (error || !profile) {
    throw new ApiError(404, `Distributor profile not found`);
  }

  const currentRankRow = profile.ranks as any;
  let currentRank: Rank | null = null;
  if (currentRankRow) {
    currentRank = {
      id: currentRankRow.id,
      name: currentRankRow.name,
      level_order: currentRankRow.level_order,
      personal_pv_required: Number(currentRankRow.personal_pv_required ?? 0),
      team_pv_required: Number(currentRankRow.team_pv_required ?? 0),
      description: currentRankRow.description ?? null,
      reward_description: currentRankRow.reward_description ?? null,
      created_at: currentRankRow.created_at,
    };
  }

  const personalPV = await getPersonalPV(distributorId);
  const teamPV = await getTeamPV(distributorId);

  return {
    currentRank,
    personalPV,
    teamPV,
  };
}

/**
 * Combines current rank, PV data, next rank requirements, and calculates difference
 */
export async function getRankProgress(distributorId: string): Promise<RankProgressResponse> {
  const { currentRank, personalPV, teamPV } = await getMyRank(distributorId);

  const allRanks = await listRanks();
  const currentLevelOrder = currentRank ? currentRank.level_order : -1;
  const nextRank = allRanks.find((r) => r.level_order === currentLevelOrder + 1) || null;

  let personalPVNeeded = 0;
  let teamPVNeeded = 0;

  if (nextRank) {
    personalPVNeeded = Math.max(0, nextRank.personal_pv_required - personalPV);
    teamPVNeeded = Math.max(0, nextRank.team_pv_required - teamPV);
  }

  return {
    currentRank,
    personalPV,
    teamPV,
    nextRank,
    personalPVNeeded,
    teamPVNeeded,
  };
}

/**
 * Promotes a distributor to a new rank and creates an audit log
 */
export async function promoteDistributor(
  distributorId: string,
  newRankId: string,
  staffId: string,
): Promise<void> {
  // Verify rank exists
  const { data: rank, error: rankError } = await supabase
    .from('ranks')
    .select('id')
    .eq('id', newRankId)
    .maybeSingle();

  if (rankError || !rank) {
    throw new ApiError(404, `Rank ${newRankId} not found`);
  }

  // Verify distributor exists
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, role')
    .eq('id', distributorId)
    .maybeSingle();

  if (profileError || !profile) {
    throw new ApiError(404, `Distributor ${distributorId} not found`);
  }

  // Update distributor's rank
  const { error: updateError } = await supabase
    .from('profiles')
    .update({ rank_id: newRankId })
    .eq('id', distributorId);

  if (updateError) {
    throw new ApiError(500, `Failed to update distributor rank: ${updateError.message}`);
  }

  // Insert audit log
  const { error: logError } = await supabase
    .from('audit_logs')
    .insert({
      action: 'rank_promoted',
      actor_id: staffId,
      entity_type: 'profile',
      entity_id: distributorId,
      metadata: { newRankId },
    });

  if (logError) {
    throw new ApiError(500, `Failed to create promotion audit log: ${logError.message}`);
  }
}
