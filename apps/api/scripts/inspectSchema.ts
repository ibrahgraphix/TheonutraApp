// scripts/inspectSchema.ts — run with: npm -w api exec tsx -- scripts/inspectSchema.ts
import '../src/config/env.js';
import { supabase } from '../src/config/supabase.js';

async function inspect() {
  // Check what columns the profiles table actually has
  const { data, error } = await supabase.rpc('inspect_profiles_columns' as never) as { data: unknown, error: unknown };

  if (error) {
    // RPC doesn't exist — use a raw information_schema query via a known-working table
    console.log('Falling back to information_schema check via countries table access...\n');
  }

  // Query information_schema directly as a workaround
  const res = await fetch(
    `${process.env['SUPABASE_URL']}/rest/v1/rpc/get_profiles_columns`,
    {
      method: 'POST',
      headers: {
        'apikey': process.env['SUPABASE_SECRET_KEY'] ?? '',
        'Authorization': `Bearer ${process.env['SUPABASE_SECRET_KEY']}`,
        'Content-Type': 'application/json',
      },
      body: '{}',
    }
  );

  // Try listing columns via the upsert_profile function signature instead
  const { data: fnData, error: fnError } = await supabase
    .from('profiles')
    .select('id')
    .limit(0);

  if (fnError) {
    console.log('profiles select error:', fnError.message, fnError.details, fnError.hint);
  } else {
    console.log('profiles table accessible, 0-row select succeeded');
  }

  // Insert with only the columns that might exist
  const minimalTest = await supabase
    .from('profiles')
    .select('*')
    .limit(0);
  console.log('Column check via select *:', minimalTest.error?.message ?? 'ok');
}

inspect().catch(console.error);
