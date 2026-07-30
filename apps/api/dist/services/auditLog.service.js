import { supabase } from '../config/supabase.js';
import { ApiError } from '../middleware/error.middleware.js';
/**
 * Logs an action to the audit log.
 * This is a generic helper called from existing staff-action services.
 */
export async function logAction(actorId, action, entityType, entityId, changes) {
    const { error } = await supabase
        .from('audit_log')
        .insert({
        actor_id: actorId,
        action,
        entity_type: entityType,
        entity_id: entityId,
        changes: changes || null,
    });
    if (error) {
        // Log to console but don't throw - audit log failure shouldn't break the main operation
        console.error(`❌ Failed to log audit action: ${error.message}`);
    }
}
/**
 * Gets paginated audit log entries with optional filters.
 * Filters: entity_type, actor_id, date range (date_from, date_to)
 * Staff only.
 */
export async function getAuditLog(filters, page = 1, limit = 20) {
    const offset = (page - 1) * limit;
    let query = supabase
        .from('audit_log')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false });
    if (filters?.entity_type) {
        query = query.eq('entity_type', filters.entity_type);
    }
    if (filters?.actor_id) {
        query = query.eq('actor_id', filters.actor_id);
    }
    if (filters?.date_from) {
        query = query.gte('created_at', filters.date_from);
    }
    if (filters?.date_to) {
        query = query.lte('created_at', filters.date_to);
    }
    const { data, count, error } = await query.range(offset, offset + limit - 1);
    if (error) {
        throw new ApiError(500, `Failed to fetch audit log: ${error.message}`);
    }
    return {
        entries: (data ?? []),
        total: count ?? 0,
        page,
        limit,
    };
}
//# sourceMappingURL=auditLog.service.js.map