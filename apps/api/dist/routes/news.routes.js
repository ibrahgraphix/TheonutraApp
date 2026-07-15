import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { requireStaff } from '../middleware/requireStaff.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { CreateContentSchema, UpdateContentSchema } from '../schemas/content.schema.js';
import { listNewsHandler, getNewsByIdHandler, createNewsHandler, updateNewsHandler, deleteNewsHandler, } from '../controllers/news.controller.js';
const router = Router();
// Apply auth middleware for all routes
router.use(authMiddleware);
// GET /news — any logged-in distributor can read
router.get('/', listNewsHandler);
// GET /news/:id — any logged-in distributor can read
router.get('/:id', getNewsByIdHandler);
// POST /news — staff only
router.post('/', requireStaff, validate(CreateContentSchema), createNewsHandler);
// PATCH /news/:id — staff only
router.patch('/:id', requireStaff, validate(UpdateContentSchema), updateNewsHandler);
// DELETE /news/:id — staff only
router.delete('/:id', requireStaff, deleteNewsHandler);
export default router;
//# sourceMappingURL=news.routes.js.map