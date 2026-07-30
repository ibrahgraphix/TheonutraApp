import * as auditLogService from '../services/auditLog.service.js';
/**
 * GET /api/audit-log
 * Returns paginated audit log entries with optional filters.
 * Filters: entity_type, actor_id, date_from, date_to
 * Staff only.
 */
export async function getAuditLogHandler(req, res, next) {
    try {
        const entityType = req.query['entity_type'];
        const actorId = req.query['actor_id'];
        const dateFrom = req.query['date_from'];
        const dateTo = req.query['date_to'];
        const page = parseInt(req.query['page'], 10) || 1;
        const limit = parseInt(req.query['limit'], 10) || 20;
        const result = await auditLogService.getAuditLog({
            entity_type: entityType,
            actor_id: actorId,
            date_from: dateFrom,
            date_to: dateTo,
        }, page, limit);
        res.status(200).json(result);
    }
    catch (err) {
        next(err);
    }
}
//# sourceMappingURL=auditLog.controller.js.map