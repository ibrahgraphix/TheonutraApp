import { createClient } from '@supabase/supabase-js';
import { env } from './env.js';
import ws from 'ws';

/**
 * Supabase client initialised with the SERVICE ROLE key.
 *
 * This client bypasses Row-Level Security entirely — it is intentionally
 * unrestricted because all authorisation is enforced at the Express layer
 * (auth.middleware + requireStaff.middleware).
 *
 * ⚠️  Never expose this client or its key to the mobile app.
 */
export const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
  auth: {
    // Disable automatic session persistence — this is a server-side client.
    persistSession: false,
    autoRefreshToken: false,
  },
  global: {
    headers: {
      // With the new sb_secret_ key format (opaque, not a JWT), supabase-js v2
      // only sets the `apikey` header automatically. We must also set the
      // Authorization header explicitly so Postgres runs as service_role and
      // RLS is bypassed for all backend queries.
      Authorization: `Bearer ${env.SUPABASE_SECRET_KEY}`,
    },
  },
  realtime: {
    // Provide a WebSocket implementation for Node.js < 22, which lacks native
    // WebSocket support. On Node.js 22+ (native WS) this is a no-op.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    transport: ws as any,
  },
});

