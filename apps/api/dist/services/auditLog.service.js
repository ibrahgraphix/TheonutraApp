import { supabase } from '../config/supabase.js';
import { ApiError } from '../middleware/error.middleware.js';
export async function logAction(actorId, action, entityType, entityId, metadata = null) {
    const { error } = await supabase
        .from('audit_logs')
        .insert({
        action,
        actor_id: actorId,
        entity_type: entityType,
        entity_id: entityId,
        metadata,
    });
    if (error) {
        throw new ApiError(500, `Failed to write audit log: ${error.message}`);
    }
}
export async function getAuditLogs(filters, page = 1, limit = 20) {
    const offset = (page - 1) * limit;
    let countQuery = supabase
        .from('audit_logs')
        .select('*', { count: 'exact', head: true });
    let dataQuery = supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false });
    if (filters.entityType) {
        countQuery = countQuery.eq('entity_type', filters.entityType);
        dataQuery = dataQuery.eq('entity_type', filters.entityType);
    }
    if (filters.actorId) {
        countQuery = countQuery.eq('actor_id', filters.actorId);
        dataQuery = dataQuery.eq('actor_id', filters.actorId);
    }
    if (filters.dateFrom) {
        countQuery = countQuery.gte('created_at', filters.dateFrom);
        dataQuery = dataQuery.gte('created_at', filters.dateFrom);
    }
    if (filters.dateTo) {
        countQuery = countQuery.lte('created_at', filters.dateTo);
        dataQuery = dataQuery.lte('created_at', filters.dateTo);
    }
    const [{ count, error: countError }, { data, error: dataError }] = await Promise.all([
        countQuery,
        dataQuery.range(offset, offset + limit - 1),
    ]);
    if (countError) {
        throw new ApiError(500, `Failed to count audit logs: ${countError.message}`);
    }
    if (dataError) {
        throw new ApiError(500, `Failed to fetch audit logs: ${dataError.message}`);
    }
    return {
        auditLogs: (data ?? []),
        total: count ?? 0,
        page,
        limit,
    };
}
//# sourceMappingURL=auditLog.service.js.map