import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { requireStaff } from '../middleware/requireStaff.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { CreateEventSchema, UpdateEventSchema } from '../schemas/events.schema.js';
import { listEventsHandler, getEventHandler, createEventHandler, updateEventHandler, deactivateEventHandler, } from '../controllers/events.controller.js';
const router = Router();
router.get('/', authMiddleware, listEventsHandler);
router.get('/:id', authMiddleware, getEventHandler);
router.post('/', authMiddleware, requireStaff, validate(CreateEventSchema), createEventHandler);
router.put('/:id', authMiddleware, requireStaff, validate(UpdateEventSchema), updateEventHandler);
router.delete('/:id', authMiddleware, requireStaff, deactivateEventHandler);
export default router;
//# sourceMappingURL=events.routes.js.map