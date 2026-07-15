import { z } from 'zod';
/**
 * Request body schema for POST /api/auth/login.
 * Reused in both the route's validate() middleware and the controller's typing.
 */
export const LoginSchema = z.object({
    distributorId: z.string().min(1, 'distributorId is required'),
    password: z.string().min(1, 'password is required'),
});
//# sourceMappingURL=auth.schema.js.map