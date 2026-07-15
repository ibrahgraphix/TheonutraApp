import { jwtVerify, createRemoteJWKSet } from 'jose';
import { env } from '../config/env.js';
import { ApiError } from './error.middleware.js';
/**
 * JWKS key set, created ONCE at module load.
 * jose caches the fetched keys and auto-refreshes when they rotate —
 * there is no per-request network call once the keys are cached.
 */
const jwks = createRemoteJWKSet(new URL(env.SUPABASE_JWKS_URL));
/**
 * Verifies the Bearer JWT in the Authorization header using the
 * Supabase JWKS endpoint (asymmetric signing — no shared secret needed).
 * On success, attaches the decoded claims to req.user.
 * On failure, throws 401 via ApiError.
 */
export async function authMiddleware(req, _res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
        return next(new ApiError(401, 'Missing or malformed Authorization header'));
    }
    const token = authHeader.slice(7);
    try {
        const { payload } = await jwtVerify(token, jwks);
        req.user = {
            id: payload.sub,
            email: payload['email'] ?? '',
            // Supabase stores custom claims in app_metadata
            role: payload['app_metadata']?.['role'] ??
                payload['user_metadata']?.['role'] ??
                'distributor',
        };
        next();
    }
    catch (err) {
        const message = err instanceof Error && err.message.includes('expired')
            ? 'Token expired'
            : 'Invalid token';
        return next(new ApiError(401, message));
    }
}
//# sourceMappingURL=auth.middleware.js.map