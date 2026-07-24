import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { getMyNotificationsHandler, getUnreadCountHandler, markAsReadHandler, markAllAsReadHandler, } from '../controllers/notification.controller.js';
const router = Router();
// Base notification routes for authenticated users
router.use(authMiddleware);
// GET /api/notifications — paginated notifications (filterable by read/unread)
router.get('/', getMyNotificationsHandler);
// GET /api/notifications/unread-count — unread count for badge
router.get('/unread-count', getUnreadCountHandler);
// PUT /api/notifications/:id/read — mark specific notification as read
router.put('/:id/read', markAsReadHandler);
// PUT /api/notifications/read-all — mark all notifications as read
router.put('/read-all', markAllAsReadHandler);
export default router;
//# sourceMappingURL=notification.routes.js.map