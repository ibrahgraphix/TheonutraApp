import * as auditLogService from '../services/auditLog.service.js';
import { ApiError } from '../middleware/error.middleware.js';
export async function getAuditLogsHandler(req, res, next) {
    try {
        if (!req.user) {
            throw new ApiError(401, 'Unauthorized');
        }
        const pageParam = req.query['page'];
        const limitParam = req.query['limit'];
        const entityTypeParam = req.query['entityType'];
        const actorIdParam = req.query['actorId'];
        const dateFromParam = req.query['dateFrom'];
        const dateToParam = req.query['dateTo'];
        const page = parseInt(Array.isArray(pageParam) ? pageParam[0] : String(pageParam || '1'), 10) || 1;
        const limit = parseInt(Array.isArray(limitParam) ? limitParam[0] : String(limitParam || '20'), 10) || 20;
        const filters = {
            entityType: Array.isArray(entityTypeParam) ? entityTypeParam[0] : typeof entityTypeParam === 'string' ? entityTypeParam : undefined,
            actorId: Array.isArray(actorIdParam) ? actorIdParam[0] : typeof actorIdParam === 'string' ? actorIdParam : undefined,
            dateFrom: Array.isArray(dateFromParam) ? dateFromParam[0] : typeof dateFromParam === 'string' ? dateFromParam : undefined,
            dateTo: Array.isArray(dateToParam) ? dateToParam[0] : typeof dateToParam === 'string' ? dateToParam : undefined,
        };
        const result = await auditLogService.getAuditLogs(filters, page, limit);
        res.status(200).json(result);
    }
    catch (err) {
        next(err);
    }
}
//# sourceMappingURL=auditLog.controller.js.map