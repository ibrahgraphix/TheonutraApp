import { jwtVerify, createRemoteJWKSet } from 'jose';
import { Request, Response, NextFunction } from 'express';
import { env } from '../config/env.js';
import { ApiError } from './error.middleware.js';

export interface AuthenticatedUser {
  id: string;    // Supabase auth.users UUID (jwt `sub` claim)
  email: string; // synthetic internal email
  role: string;  // from app_metadata.role
}

// Extend Express's Request type so controllers can access req.user safely.
declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

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
export async function authMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return next(new ApiError(401, 'Missing or malformed Authorization header'));
  }

  const token = authHeader.slice(7);

  try {
    const { payload } = await jwtVerify(token, jwks);

    req.user = {
      id: payload.sub as string,
      email: (payload['email'] as string) ?? '',
      // Supabase stores custom claims in app_metadata
      role:
        (payload['app_metadata'] as Record<string, unknown>)?.['role'] as string ??
        (payload['user_metadata'] as Record<string, unknown>)?.['role'] as string ??
        'distributor',
    };

    next();
  } catch (err: unknown) {
    const message =
      err instanceof Error && err.message.includes('expired')
        ? 'Token expired'
        : 'Invalid token';
    return next(new ApiError(401, message));
  }
}
