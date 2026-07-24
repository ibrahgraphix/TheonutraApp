import * as eventsService from '../services/events.service.js';
import * as auditLogService from '../services/auditLog.service.js';
import { ApiError } from '../middleware/error.middleware.js';
export async function listEventsHandler(req, res, next) {
    try {
        if (!req.user) {
            throw new ApiError(401, 'Unauthorized');
        }
        const pageParam = req.query['page'];
        const limitParam = req.query['limit'];
        const typeParam = req.query['type'];
        const upcomingParam = req.query['upcoming'];
        const pastParam = req.query['past'];
        const dateFromParam = req.query['dateFrom'];
        const dateToParam = req.query['dateTo'];
        const page = parseInt(Array.isArray(pageParam) ? pageParam[0] : String(pageParam || '1'), 10) || 1;
        const limit = parseInt(Array.isArray(limitParam) ? limitParam[0] : String(limitParam || '20'), 10) || 20;
        const eventType = Array.isArray(typeParam) ? typeParam[0] : typeof typeParam === 'string' ? typeParam : undefined;
        const upcoming = Array.isArray(upcomingParam) ? upcomingParam[0] === 'true' : upcomingParam === 'true';
        const past = Array.isArray(pastParam) ? pastParam[0] === 'true' : pastParam === 'true';
        const dateFrom = Array.isArray(dateFromParam) ? dateFromParam[0] : typeof dateFromParam === 'string' ? dateFromParam : undefined;
        const dateTo = Array.isArray(dateToParam) ? dateToParam[0] : typeof dateToParam === 'string' ? dateToParam : undefined;
        const filters = {
            eventType: eventType,
            dateFrom,
            dateTo,
        };
        const result = upcoming || !past
            ? await eventsService.listUpcomingEvents(filters, page, limit)
            : await eventsService.listPastEvents(filters, page, limit);
        res.status(200).json(result);
    }
    catch (err) {
        next(err);
    }
}
export async function getEventHandler(req, res, next) {
    try {
        if (!req.user) {
            throw new ApiError(401, 'Unauthorized');
        }
        const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
        if (!id) {
            throw new ApiError(400, 'Event ID is required');
        }
        const event = await eventsService.getEvent(id);
        res.status(200).json(event);
    }
    catch (err) {
        next(err);
    }
}
export async function createEventHandler(req, res, next) {
    try {
        if (!req.user) {
            throw new ApiError(401, 'Unauthorized');
        }
        const input = req.body;
        const event = await eventsService.createEvent(req.user.id, input);
        await auditLogService.logAction(req.user.id, 'event_created', 'event', event.id, {
            title: event.title,
            eventType: event.event_type,
        });
        res.status(201).json(event);
    }
    catch (err) {
        next(err);
    }
}
export async function updateEventHandler(req, res, next) {
    try {
        if (!req.user) {
            throw new ApiError(401, 'Unauthorized');
        }
        const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
        if (!id) {
            throw new ApiError(400, 'Event ID is required');
        }
        const input = req.body;
        const event = await eventsService.updateEvent(id, req.user.id, input);
        await auditLogService.logAction(req.user.id, 'event_updated', 'event', event.id, { updatedFields: Object.keys(input) });
        res.status(200).json(event);
    }
    catch (err) {
        next(err);
    }
}
export async function deactivateEventHandler(req, res, next) {
    try {
        if (!req.user) {
            throw new ApiError(401, 'Unauthorized');
        }
        const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
        if (!id) {
            throw new ApiError(400, 'Event ID is required');
        }
        await eventsService.deactivateEvent(id);
        await auditLogService.logAction(req.user.id, 'event_deactivated', 'event', id, null);
        res.status(200).json({ message: 'Event deactivated successfully' });
    }
    catch (err) {
        next(err);
    }
}
//# sourceMappingURL=events.controller.js.map