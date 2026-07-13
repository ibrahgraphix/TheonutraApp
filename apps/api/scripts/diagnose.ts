// Quick diagnostic — run with: npm -w api exec tsx -- scripts/diagnose.ts
import '../src/config/env.js';
import { env } from '../src/config/env.js';
import { createClient } from '@supabase/supabase-js';

// Test 1: default init (just secret key, no extra headers)
const client1 = createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// Test 2: explicit Authorization header override
const client2 = createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { headers: { Authorization: `Bearer ${env.SUPABASE_SECRET_KEY}` } },
});

async function run() {
  console.log('SUPABASE_URL   :', env.SUPABASE_URL);
  console.log('SECRET_KEY     :', env.SUPABASE_SECRET_KEY.slice(0, 20) + '…\n');

  for (const [label, client] of [['client1 (default)', client1], ['client2 (explicit header)', client2]] as const) {
    console.log(`── ${label} ──`);
    const { data, error } = await (client as typeof client1)
      .from('countries')
      .select('id, name')
      .limit(1);
    if (error) {
      console.log('  ERROR code   :', error.code);
      console.log('  ERROR message:', error.message);
      console.log('  ERROR details:', error.details);
      console.log('  ERROR hint   :', error.hint);
    } else {
      console.log('  SUCCESS, rows:', data);
    }
    console.log();
  }

  // Test 3: auth.admin API
  console.log('── auth.admin.listUsers ──');
  const { data: users, error: usersError } = await client1.auth.admin.listUsers({ perPage: 1 });
  if (usersError) {
    console.log('  ERROR:', usersError.message);
  } else {
    console.log('  SUCCESS, user count:', users.users.length);
  }
}

run().catch(console.error);
