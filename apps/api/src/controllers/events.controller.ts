import { Request, Response, NextFunction } from 'express';
import * as eventsService from '../services/events.service.js';
import { ApiError } from '../middleware/error.middleware.js';

/**
 * GET /api/events
 * Lists upcoming events with optional filters (type, date range).
 */
export async function listUpcomingEventsHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const eventType = req.query['type'] as string | undefined;
    const startFrom = req.query['start_from'] as string | undefined;
    const startTo = req.query['start_to'] as string | undefined;

    const events = await eventsService.listUpcomingEvents({
      event_type: eventType as any,
      start_from: startFrom,
      start_to: startTo,
    });
    res.status(200).json(events);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/events/past
 * Lists past events.
 */
export async function listPastEventsHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const events = await eventsService.listPastEvents();
    res.status(200).json(events);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/events/:id
 * Gets a specific event by ID.
 */
export async function getEventHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { id } = req.params;
    if (!id || typeof id !== 'string') {
      throw new ApiError(400, 'Event ID is required');
    }
    const event = await eventsService.getEvent(id);
    res.status(200).json(event);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/events
 * Creates a new event. Staff only.
 */
export async function createEventHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) {
      throw new ApiError(401, 'Unauthorized');
    }
    const input = req.body;
    const event = await eventsService.createEvent(req.user.id, input);
    res.status(201).json(event);
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/events/:id
 * Updates an existing event. Staff only.
 */
export async function updateEventHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) {
      throw new ApiError(401, 'Unauthorized');
    }
    const { id } = req.params;
    if (!id || typeof id !== 'string') {
      throw new ApiError(400, 'Event ID is required');
    }
    const input = req.body;
    const event = await eventsService.updateEvent(id, input);
    res.status(200).json(event);
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/events/:id
 * Deactivates an event (soft delete). Staff only.
 */
export async function deactivateEventHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) {
      throw new ApiError(401, 'Unauthorized');
    }
    const { id } = req.params;
    if (!id || typeof id !== 'string') {
      throw new ApiError(400, 'Event ID is required');
    }
    await eventsService.deactivateEvent(id);
    res.status(200).json({ message: 'Event deactivated successfully' });
  } catch (err) {
    next(err);
  }
}
