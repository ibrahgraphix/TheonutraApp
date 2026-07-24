import { Request, Response, NextFunction } from 'express';
import * as notificationService from '../services/notification.service.js';
import { ApiError } from '../middleware/error.middleware.js';

/**
 * GET /api/notifications
 * Returns paginated notifications for the authenticated user.
 * Can filter by read/unread status via query param.
 */
export async function getMyNotificationsHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) {
      throw new ApiError(401, 'Unauthorized');
    }
    const pageParam = req.query['page'];
    const limitParam = req.query['limit'];
    const pageStr = Array.isArray(pageParam) ? pageParam[0] : String(pageParam || '1');
    const limitStr = Array.isArray(limitParam) ? limitParam[0] : String(limitParam || '20');
    const page = parseInt(pageStr as string, 10) || 1;
    const limit = parseInt(limitStr as string, 10) || 20;
    const unreadOnly = req.query['unreadOnly'] === 'true';

    const result = await notificationService.getMyNotifications(req.user.id, page, limit, unreadOnly);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/notifications/unread-count
 * Returns the unread notification count for the authenticated user.
 */
export async function getUnreadCountHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) {
      throw new ApiError(401, 'Unauthorized');
    }
    const count = await notificationService.getUnreadCount(req.user.id);
    res.status(200).json({ count });
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/notifications/:id/read
 * Marks a specific notification as read.
 */
export async function markAsReadHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) {
      throw new ApiError(401, 'Unauthorized');
    }
    const { id } = req.params;
    if (!id || Array.isArray(id)) {
      throw new ApiError(400, 'Notification ID is required');
    }
    await notificationService.markAsRead(req.user.id, id as string);
    res.status(200).json({ message: 'Notification marked as read' });
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/notifications/read-all
 * Marks all notifications as read for the authenticated user.
 */
export async function markAllAsReadHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) {
      throw new ApiError(401, 'Unauthorized');
    }
    const count = await notificationService.markAllAsRead(req.user.id);
    res.status(200).json({ message: `Marked ${count} notifications as read`, count });
  } catch (err) {
    next(err);
  }
}
