import { Request, Response, NextFunction } from 'express';
import * as eventsService from '../services/events.service.js';
import { ApiError } from '../middleware/error.middleware.js';

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
 * GET /api/events/admin/list
 * Lists ALL events including inactive ones. Staff only.
 */
export async function listAllEventsForAdminHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const events = await eventsService.listAllEventsForAdmin();
    res.status(200).json(events);
  } catch (err) {
    next(err);
  }
}

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

/**
 * DELETE /api/events/:id/permanent
 * Permanently deletes an event and its Cloudinary banner. Staff only.
 */
export async function hardDeleteEventHandler(
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
    await eventsService.hardDeleteEvent(id);
    res.status(200).json({ message: 'Event permanently deleted' });
  } catch (err) {
    next(err);
  }
}