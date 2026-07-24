import { supabase } from '../config/supabase.js';
import { ApiError } from '../middleware/error.middleware.js';
import * as notificationService from './notification.service.js';
import * as auditLogService from './auditLog.service.js';
/**
 * Inserts a manual bonus record (which automatically triggers the wallet credit/ledger entry).
 */
export async function awardBonus(staffId, distributorId, category, amount, note) {
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
    // Send notification to the distributor
    try {
        await notificationService.notifyManualBonus(distributorId, amount, note || category);
    }
    catch (notifError) {
        console.error(`❌ Failed to send manual bonus notification: ${notifError}`);
        // Don't throw - notification failure shouldn't break the bonus award
    }
    const bonus = {
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
    };
    await auditLogService.logAction(staffId, 'manual_bonus_awarded', 'manual_bonus', bonus.id, {
        distributorId,
        amount: bonus.amount,
        category,
        note: note || null,
    });
    return bonus;
}
/**
 * Returns paginated list of manual bonuses for a specific distributor.
 */
export async function listBonusesForDistributor(distributorId, page = 1, limit = 20) {
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
        })),
        total: count ?? 0,
        page,
        limit,
    };
}
/**
 * Returns a filterable, paginated list of all manual bonuses (staff only).
 */
export async function listAllBonuses(filters, page = 1, limit = 20) {
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
        })),
        total: count ?? 0,
        page,
        limit,
    };
}
//# sourceMappingURL=manualBonus.service.js.map