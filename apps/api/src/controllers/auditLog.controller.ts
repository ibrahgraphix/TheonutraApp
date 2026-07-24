import { Request, Response, NextFunction } from 'express';
import * as auditLogService from '../services/auditLog.service.js';
import { ApiError } from '../middleware/error.middleware.js';

/**
 * GET /api/audit-log
 * Returns paginated audit log entries with optional filters.
 * Filters: entity_type, actor_id, date_from, date_to
 * Staff only.
 */
export async function getAuditLogHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const entityType = req.query['entity_type'] as string | undefined;
    const actorId = req.query['actor_id'] as string | undefined;
    const dateFrom = req.query['date_from'] as string | undefined;
    const dateTo = req.query['date_to'] as string | undefined;
    const page = parseInt(req.query['page'] as string, 10) || 1;
    const limit = parseInt(req.query['limit'] as string, 10) || 20;

    const result = await auditLogService.getAuditLog(
      {
        entity_type: entityType,
        actor_id: actorId,
        date_from: dateFrom,
        date_to: dateTo,
      },
      page,
      limit,
    );
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}
