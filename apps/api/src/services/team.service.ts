import { supabase } from '../config/supabase.js';
import { ApiError } from '../middleware/error.middleware.js';

// ── Shared shapes ─────────────────────────────────────────────────────────────

export interface TeamMember {
  /** profiles.id of this downline member */
  memberId: string;
  distributorId: string;
  fullName: string;
  phoneNumber: string;
  countryId: string;
  /** profiles.id of who recruited this member */
  referredBy: string | null;
  isActive: boolean;
  /** 1 = direct recruit, 2 = their recruit, etc. */
  level: number;
  /** Aggregate personal sales amount this calendar month (0 if none) */
  monthlySales: number;
  /** ISO timestamp this member's account was created — powers "Joined <date>" */
  createdAt: string;
}

// ── Private helpers ───────────────────────────────────────────────────────────

/**
 * Fetches all rows from `downline_tree` for the given root distributor UUID,
 * optionally limited to a specific level, then enriches them with:
 *  - extra profile fields (phone, country, is_active, created_at) via a bulk
 *    profile fetch
 *  - current-month personal sales aggregated from the `sales` table
 */
async function fetchTeam(
  distributorId: string,
  levelFilter?: number,
): Promise<TeamMember[]> {
  // ── 1. Query the view ──────────────────────────────────────────────────────
  let query = supabase
    .from('downline_tree')
    .select('root_id, member_id, full_name, distributor_id, referred_by, level')
    .eq('root_id', distributorId)
    .order('level', { ascending: true })
    .order('full_name', { ascending: true });

  if (levelFilter !== undefined) {
    query = query.eq('level', levelFilter);
  }

  const { data: rows, error: viewError } = await query;

  if (viewError) {
    throw new ApiError(500, `Failed to query team: ${viewError.message}`);
  }

  if (!rows || rows.length === 0) {
    return [];
  }

  const memberIds = rows.map((r) => r.member_id as string);

  // ── 2. Bulk-fetch profile extras (phone, country, is_active, created_at) ──
  const { data: profiles, error: profileError } = await supabase
    .from('profiles')
    .select('id, phone_number, country_id, is_active, created_at')
    .in('id', memberIds);

  if (profileError) {
    throw new ApiError(500, `Failed to fetch team profiles: ${profileError.message}`);
  }

  const profileMap = new Map<
    string,
    { phoneNumber: string; countryId: string; isActive: boolean; createdAt: string }
  >();
  for (const p of profiles ?? []) {
    profileMap.set(p.id as string, {
      phoneNumber: p.phone_number as string,
      countryId: p.country_id as string,
      isActive: p.is_active as boolean,
      createdAt: p.created_at as string,
    });
  }

  // ── 3. Aggregate current-month personal sales for each member ─────────────
  //  Use the first day of the current UTC month as the lower bound.
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();

  const { data: salesRows, error: salesError } = await supabase
    .from('sales')
    .select('distributor_id, amount')
    .in('distributor_id', memberIds)
    .gte('sale_date', monthStart.slice(0, 10)); // sale_date is a `date` column

  if (salesError) {
    throw new ApiError(500, `Failed to fetch team sales: ${salesError.message}`);
  }

  // Build a map: memberId → sum(amount) this month
  const salesMap = new Map<string, number>();
  for (const s of salesRows ?? []) {
    const prev = salesMap.get(s.distributor_id as string) ?? 0;
    salesMap.set(s.distributor_id as string, prev + Number(s.amount));
  }

  // ── 4. Assemble the response ───────────────────────────────────────────────
  return rows.map((r) => {
    const profile = profileMap.get(r.member_id as string);
    return {
      memberId: r.member_id as string,
      distributorId: r.distributor_id as string,
      fullName: r.full_name as string,
      phoneNumber: profile?.phoneNumber ?? '',
      countryId: profile?.countryId ?? '',
      referredBy: (r.referred_by as string) ?? null,
      isActive: profile?.isActive ?? true,
      level: r.level as number,
      monthlySales: salesMap.get(r.member_id as string) ?? 0,
      createdAt: profile?.createdAt ?? '',
    };
  });
}

// ── Public service functions ──────────────────────────────────────────────────

/**
 * Returns the full multi-level downline for a distributor as a flat list.
 * The frontend reconstructs the tree using `referredBy` + `level`.
 *
 * @param distributorId  auth.users UUID of the requesting distributor
 */
export async function getMyTeam(distributorId: string): Promise<TeamMember[]> {
  return fetchTeam(distributorId);
}

/**
 * Returns only direct recruits (level = 1) for the given distributor.
 * Used by the initial (collapsed) team view in the mobile app.
 *
 * @param distributorId  auth.users UUID of the requesting distributor
 */
export async function getDirectRecruits(distributorId: string): Promise<TeamMember[]> {
  return fetchTeam(distributorId, 1);
}

/**
 * Staff helper: returns each distributor's direct recruit count in bulk.
 *
 * NOTE: `sellers.service.ts → listSellers` already computes `directDownlineCount`
 * inline (via a second profiles query) for the sellers list screen. This function
 * exists as a standalone utility for any future staff dashboard that needs the
 * same data outside the paginated sellers list.
 */
export async function getTeamCountsBySeller(): Promise<Record<string, number>> {
  const { data, error } = await supabase
    .from('profiles')
    .select('referred_by')
    .not('referred_by', 'is', null);

  if (error) {
    throw new ApiError(500, `Failed to fetch team counts: ${error.message}`);
  }

  const counts: Record<string, number> = {};
  for (const row of data ?? []) {
    const sponsor = row.referred_by as string;
    counts[sponsor] = (counts[sponsor] ?? 0) + 1;
  }
  return counts;
}