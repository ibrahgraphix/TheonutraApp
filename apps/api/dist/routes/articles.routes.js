import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { requireStaff } from '../middleware/requireStaff.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { CreateContentSchema, UpdateContentSchema } from '../schemas/content.schema.js';
import { listArticlesHandler, getArticleByIdHandler, createArticleHandler, updateArticleHandler, deleteArticleHandler, } from '../controllers/articles.controller.js';
const router = Router();
// Apply auth middleware for all routes
router.use(authMiddleware);
// GET /articles — any logged-in distributor can read
router.get('/', listArticlesHandler);
// GET /articles/:id — any logged-in distributor can read
router.get('/:id', getArticleByIdHandler);
// POST /articles — staff only
router.post('/', requireStaff, validate(CreateContentSchema), createArticleHandler);
// PATCH /articles/:id — staff only
router.patch('/:id', requireStaff, validate(UpdateContentSchema), updateArticleHandler);
// DELETE /articles/:id — staff only
router.delete('/:id', requireStaff, deleteArticleHandler);
export default router;
//# sourceMappingURL=articles.routes.js.map