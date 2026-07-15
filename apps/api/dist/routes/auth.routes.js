import { Router } from 'express';
import { validate } from '../middleware/validate.middleware.js';
import { LoginSchema } from '../schemas/auth.schema.js';
import { loginHandler } from '../controllers/auth.controller.js';
const router = Router();
/**
 * POST /api/auth/login
 * Public — no authMiddleware (this is how you obtain the token).
 */
router.post('/login', validate(LoginSchema), loginHandler);
export default router;
//# sourceMappingURL=auth.routes.js.map