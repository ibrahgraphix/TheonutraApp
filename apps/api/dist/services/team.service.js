import { supabase } from '../config/supabase.js';
import { ApiError } from '../middleware/error.middleware.js';
// ── Private helpers ───────────────────────────────────────────────────────────
async function fetchTeam(distributorId, levelFilter) {
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
    const memberIds = rows.map((r) => r.member_id);
    // ── 2. Bulk-fetch profile extras (phone, country, is_active, created_at) ──
    const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('id, phone_number, country_id, is_active, created_at')
        .in('id', memberIds);
    if (profileError) {
        throw new ApiError(500, `Failed to fetch team profiles: ${profileError.message}`);
    }
    const profileMap = new Map();
    for (const p of profiles ?? []) {
        profileMap.set(p.id, {
            phoneNumber: p.phone_number,
            countryId: p.country_id,
            isActive: p.is_active,
            createdAt: p.created_at,
        });
    }
    // ── 2.5. Bulk-fetch active status + leadership rank NAMES for the tree ────
    const { data: rankedProfiles, error: rankProfileError } = await supabase
        .from('profiles')
        .select('id, active_status_rank_id, leadership_rank_id')
        .in('id', memberIds);
    if (rankProfileError) {
        throw new ApiError(500, `Failed to fetch team rank assignments: ${rankProfileError.message}`);
    }
    const activeStatusRankIds = [
        ...new Set((rankedProfiles ?? []).map((p) => p.active_status_rank_id).filter(Boolean)),
    ];
    const leadershipRankIds = [
        ...new Set((rankedProfiles ?? []).map((p) => p.leadership_rank_id).filter(Boolean)),
    ];
    const activeStatusNameMap = new Map();
    if (activeStatusRankIds.length > 0) {
        const { data: activeStatusRanks, error: asrError } = await supabase
            .from('active_status_ranks')
            .select('id, name')
            .in('id', activeStatusRankIds);
        if (asrError) {
            throw new ApiError(500, `Failed to fetch active status rank names: ${asrError.message}`);
        }
        for (const r of activeStatusRanks ?? []) {
            activeStatusNameMap.set(r.id, r.name);
        }
    }
    const leadershipNameMap = new Map();
    if (leadershipRankIds.length > 0) {
        const { data: leadershipRanks, error: lrError } = await supabase
            .from('leadership_ranks')
            .select('id, name')
            .in('id', leadershipRankIds);
        if (lrError) {
            throw new ApiError(500, `Failed to fetch leadership rank names: ${lrError.message}`);
        }
        for (const r of leadershipRanks ?? []) {
            leadershipNameMap.set(r.id, r.name);
        }
    }
    const rankMap = new Map();
    for (const rp of rankedProfiles ?? []) {
        rankMap.set(rp.id, {
            activeStatus: rp.active_status_rank_id
                ? activeStatusNameMap.get(rp.active_status_rank_id)
                : undefined,
            leadership: rp.leadership_rank_id
                ? leadershipNameMap.get(rp.leadership_rank_id) ?? null
                : null,
        });
    }
    // ── 3. Aggregate current-month personal sales for each member ─────────────
    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
    const { data: salesRows, error: salesError } = await supabase
        .from('sales')
        .select('distributor_id, amount')
        .in('distributor_id', memberIds)
        .gte('sale_date', monthStart.slice(0, 10));
    if (salesError) {
        throw new ApiError(500, `Failed to fetch team sales: ${salesError.message}`);
    }
    const salesMap = new Map();
    for (const s of salesRows ?? []) {
        const prev = salesMap.get(s.distributor_id) ?? 0;
        salesMap.set(s.distributor_id, prev + Number(s.amount));
    }
    // ── 4. Assemble the response ───────────────────────────────────────────────
    return rows.map((r) => {
        const profile = profileMap.get(r.member_id);
        const ranks = rankMap.get(r.member_id);
        return {
            memberId: r.member_id,
            distributorId: r.distributor_id,
            fullName: r.full_name,
            phoneNumber: profile?.phoneNumber ?? '',
            countryId: profile?.countryId ?? '',
            referredBy: r.referred_by ?? null,
            isActive: profile?.isActive ?? true,
            level: r.level,
            monthlySales: salesMap.get(r.member_id) ?? 0,
            createdAt: profile?.createdAt ?? '',
            activeStatusRankName: ranks?.activeStatus,
            leadershipRankName: ranks?.leadership ?? null,
        };
    });
}
// ── Public service functions ──────────────────────────────────────────────────
export async function getMyTeam(distributorId) {
    return fetchTeam(distributorId);
}
export async function getDirectRecruits(distributorId) {
    return fetchTeam(distributorId, 1);
}
export async function getTeamCountsBySeller() {
    const { data, error } = await supabase
        .from('profiles')
        .select('referred_by')
        .not('referred_by', 'is', null);
    if (error) {
        throw new ApiError(500, `Failed to fetch team counts: ${error.message}`);
    }
    const counts = {};
    for (const row of data ?? []) {
        const sponsor = row.referred_by;
        counts[sponsor] = (counts[sponsor] ?? 0) + 1;
    }
    return counts;
}
//# sourceMappingURL=team.service.js.map