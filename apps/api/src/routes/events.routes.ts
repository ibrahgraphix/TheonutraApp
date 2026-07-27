import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { requireStaff } from '../middleware/requireStaff.middleware.js';
import {
  listUpcomingEventsHandler,
  listPastEventsHandler,
  listAllEventsForAdminHandler,
  getEventHandler,
  createEventHandler,
  updateEventHandler,
  deactivateEventHandler,
  hardDeleteEventHandler,
} from '../controllers/events.controller.js';

const router = Router();

router.use(authMiddleware);

router.get('/admin/list', requireStaff, listAllEventsForAdminHandler);
router.get('/', listUpcomingEventsHandler);
router.get('/past', listPastEventsHandler);
router.get('/:id', getEventHandler);

router.post('/', requireStaff, createEventHandler);
router.put('/:id', requireStaff, updateEventHandler);
router.delete('/:id', requireStaff, deactivateEventHandler);
router.delete('/:id/permanent', requireStaff, hardDeleteEventHandler);

export default router;