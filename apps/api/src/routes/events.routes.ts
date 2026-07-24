import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { requireStaff } from '../middleware/requireStaff.middleware.js';
import {
  listUpcomingEventsHandler,
  listPastEventsHandler,
  getEventHandler,
  createEventHandler,
  updateEventHandler,
  deactivateEventHandler,
} from '../controllers/events.controller.js';

const router = Router();

// Public routes (authenticated users can view events)
router.use(authMiddleware);

// GET /api/events — list upcoming events with optional filters
router.get('/', listUpcomingEventsHandler);

// GET /api/events/past — list past events
router.get('/past', listPastEventsHandler);

// GET /api/events/:id — get specific event
router.get('/:id', getEventHandler);

// Staff-only routes for event management
// POST /api/events — create new event
router.post('/', requireStaff, createEventHandler);

// PUT /api/events/:id — update event
router.put('/:id', requireStaff, updateEventHandler);

// DELETE /api/events/:id — deactivate event (soft delete)
router.delete('/:id', requireStaff, deactivateEventHandler);

export default router;
