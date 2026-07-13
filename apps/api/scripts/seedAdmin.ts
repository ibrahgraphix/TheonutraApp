/**
 * scripts/seedAdmin.ts
 *
 * One-time script that creates the first admin account directly in Supabase,
 * bypassing the normal "Add Seller" flow (which itself requires a logged-in
 * admin — chicken-and-egg problem).
 *
 * Run from the project root:
 *   npm -w api run seed:admin
 *
 * ── What this script does ─────────────────────────────────────────────────────
 *  1. Upserts a Tanzania row in `countries` (safe to run even if it exists)
 *  2. Creates a Supabase Auth user with the synthetic internal email + password
 *  3. Inserts the matching `profiles` row with role = 'admin'
 *
 * ── Configuration ─────────────────────────────────────────────────────────────
 * Edit the ADMIN_CONFIG block below before running.
 * Do NOT commit real passwords — this file is for initial bootstrap only.
 * ─────────────────────────────────────────────────────────────────────────────
 */

// Load env first, before any other import touches process.env
import '../src/config/env.js';

import { supabase } from '../src/config/supabase.js';
import { distributorIdToEmail } from '../src/utils/distributorAuth.js';

// ── ✏️  Edit these before running ─────────────────────────────────────────────
const ADMIN_CONFIG = {
  distributorId: 'ADMIN-001',
  fullName: 'System Administrator',
  phoneNumber: '+255700000000',
  password: 'ChangeMe123!', // admin must change this on first real login
} as const;
// ─────────────────────────────────────────────────────────────────────────────

async function seedAdmin() {
  console.log('🌱  Seeding admin account…\n');

  // ── Step 1: Upsert Tanzania country row ──────────────────────────────────
  console.log('  [1/3] Upserting Tanzania country row…');
  const { data: country, error: countryError } = await supabase
    .from('countries')
    .upsert(
      {
        name: 'Tanzania',
        iso_code: 'TZ',
        currency_code: 'TZS',
        is_active: true,
      },
      { onConflict: 'iso_code', ignoreDuplicates: false },
    )
    .select('id, name')
    .single();

  if (countryError || !country) {
    console.error('  ❌  Failed to upsert country:', countryError?.message);
    process.exit(1);
  }
  console.log(`  ✅  Country ready: ${country.name} (${country.id})\n`);

  // ── Step 2: Create Supabase Auth user ─────────────────────────────────────
  const email = distributorIdToEmail(ADMIN_CONFIG.distributorId);
  console.log(`  [2/3] Creating auth user: ${email}`);

  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password: ADMIN_CONFIG.password,
    email_confirm: true, // skip the email-verification flow
    app_metadata: { role: 'admin' }, // baked into the JWT — no extra DB query on every request
  });

  if (authError) {
    if (authError.message.includes('already been registered')) {
      console.warn('  ⚠️   Auth user already exists — skipping creation, will still upsert profile.\n');
    } else {
      console.error('  ❌  Failed to create auth user:', authError.message);
      process.exit(1);
    }
  }

  // Fetch the user (whether just created or pre-existing) to get the UUID
  const { data: existingUsers } = await supabase.auth.admin.listUsers();
  const authUser = existingUsers?.users.find((u) => u.email === email);

  if (!authUser) {
    console.error('  ❌  Could not locate auth user after creation attempt.');
    process.exit(1);
  }
  console.log(`  ✅  Auth user ready: ${authUser.id}\n`);

  // ── Step 3: Upsert profiles row via upsert_profile() RPC ─────────────────
  // Calling a Postgres function via .rpc() is immune to the PostgREST schema
  // cache — the function definition is what matters, not the cache.
  // The upsert_profile() function is defined in helpers.sql.
  console.log('  [3/3] Upserting profiles row…');

  const { error: profileError } = await supabase.rpc('upsert_profile', {
    p_id:                   authUser.id,
    p_distributor_id:       ADMIN_CONFIG.distributorId,
    p_full_name:            ADMIN_CONFIG.fullName,
    p_phone_number:         ADMIN_CONFIG.phoneNumber,
    p_role:                 'admin',
    p_country_id:           country.id,
    p_referred_by:          null,
    p_is_active:            true,
    p_must_change_password: false,
    p_created_by:           null,
  });

  if (profileError) {
    if (profileError.message.includes('upsert_profile')) {
      console.error('  ❌  RPC function not found. Run helpers.sql in Supabase SQL Editor first:\n');
      console.error('      File: apps/api/helpers.sql\n');
    } else {
      console.error('  ❌  Failed to upsert profile:', profileError.message);
    }
    process.exit(1);
  }

  console.log('  ✅  Profile row ready.\n');

  console.log('─────────────────────────────────────────────');
  console.log('🎉  Admin seeded successfully!\n');
  console.log(`  Distributor ID : ${ADMIN_CONFIG.distributorId}`);
  console.log(`  Password       : ${ADMIN_CONFIG.password}`);
  console.log('\n  Log in at:  POST /api/auth/login');
  console.log('  Body:       { "distributorId": "ADMIN-001", "password": "..." }');
  console.log('─────────────────────────────────────────────\n');
}

seedAdmin().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});

