/**
 * scripts/testAnalyticsAccount.ts — Step 8 verification
 *
 * Prerequisites:
 *  1. Dev server running  (npm -w api run dev)
 *  2. seed:catalog run    (npm -w api run seed:catalog)
 *  3. At least one seller exists with orders from Steps 6-7
 *
 * Run:
 *   npm -w api run test:analytics
 */

import '../src/config/env.js';
import { login } from '../src/services/auth.service.js';
import { supabase } from '../src/config/supabase.js';

const PORT = process.env['PORT'] || 3001;
const BASE = `http://localhost:${PORT}/api`;

// ── helpers ───────────────────────────────────────────────────────────────────

async function api(
  method: string,
  path: string,
  token: string,
  body?: unknown,
): Promise<{ status: number; json: unknown }> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => null);
  return { status: res.status, json };
}

// ── main ──────────────────────────────────────────────────────────────────────

async function run() {
  console.log('🧪  Step 8 — Analytics & Account verification\n');

  // ── Tokens ────────────────────────────────────────────────────────────────
  console.log('🔑  Logging in as admin…');
  const { token: adminToken } = await login('ADMIN-001', 'ChangeMe123!');
  console.log(`  ✅  Admin token: ${adminToken.slice(0, 30)}…\n`);

  // ── Setup: Create a throwaway seller for account deletion test ─────────────
  console.log('👤  Setting up throwaway seller for account deletion test…');

  const { data: tzCountry } = await supabase
    .from('countries')
    .select('id')
    .eq('iso_code', 'TZ')
    .single();
  if (!tzCountry) throw new Error('Tanzania not seeded — run seed:catalog first');
  const tzId = tzCountry.id as string;

  const timestamp = Date.now().toString().slice(-4);
  const throwawayId = `BF-TZ-DEL${timestamp}`;

  // Clean up if exists
  const { data: existing } = await supabase
    .from('profiles')
    .select('id')
    .eq('distributor_id', throwawayId)
    .maybeSingle();
  if (existing) {
    await supabase.auth.admin.deleteUser(existing.id);
    await supabase.from('profiles').delete().eq('id', existing.id);
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  const throwawayRes = await api('POST', '/sellers', adminToken, {
    distributorId: throwawayId,
    fullName: 'Throwaway Seller',
    phoneNumber: '+255733333333',
    password: 'ThrowawayPass123!',
    countryId: tzId,
  });
  if (throwawayRes.status !== 201) throw new Error(`Failed to create throwaway: ${JSON.stringify(throwawayRes.json)}`);
  const throwaway = throwawayRes.json as any;
  console.log(`  ✅  Throwaway seller created: ${throwaway.distributorId}\n`);

  const { token: throwawayToken } = await login(throwawayId, 'ThrowawayPass123!');
  console.log(`  ✅  Throwaway seller logged in\n`);

  // ── Test 1: GET /api/analytics/overview ───────────────────────────────────
  console.log('1️⃣   GET /api/analytics/overview as throwaway seller…');
  const overviewRes = await api('GET', '/analytics/overview', throwawayToken);
  console.log(`  Status: ${overviewRes.status}`);
  if (overviewRes.status !== 200) {
    console.error(`  Error response: ${JSON.stringify(overviewRes.json)}`);
    throw new Error(`Expected 200, got ${overviewRes.status}`);
  }
  const overview = overviewRes.json as any;
  console.log(`  ✅  Month: ${overview.month}`);
  console.log(`  ✅  Personal sales: ${overview.personalSales}`);
  console.log(`  ✅  Team sales: ${overview.teamSales}`);
  console.log(`  ✅  Bonus earned: ${overview.bonusEarned}\n`);

  // ── Test 2: GET /api/analytics/orders pagination ───────────────────────────
  console.log('2️⃣   GET /api/analytics/orders?page=1&limit=10…');
  const ordersRes = await api('GET', '/analytics/orders?page=1&limit=10', throwawayToken);
  console.log(`  Status: ${ordersRes.status}`);
  if (ordersRes.status !== 200) throw new Error(`Expected 200, got ${ordersRes.status}`);
  const orders = ordersRes.json as any[];
  console.log(`  ✅  Retrieved ${orders.length} order(s)\n`);

  // ── Test 3: PATCH /api/account/password with wrong current password ────────
  console.log('3️⃣   PATCH /api/account/password with WRONG current password…');
  const wrongPassRes = await api('PATCH', '/account/password', throwawayToken, {
    currentPassword: 'WrongPassword123!',
    newPassword: 'NewPassword123!',
  });
  console.log(`  Status: ${wrongPassRes.status}`);
  if (wrongPassRes.status !== 401) throw new Error(`Expected 401, got ${wrongPassRes.status}`);
  console.log(`  ✅  Correctly rejected with 401: ${(wrongPassRes.json as any).message}\n`);

  // ── Test 4: PATCH /api/account/password with correct password ────────────
  console.log('4️⃣   PATCH /api/account/password with CORRECT current password…');
  const correctPassRes = await api('PATCH', '/account/password', throwawayToken, {
    currentPassword: 'ThrowawayPass123!',
    newPassword: 'NewPassword456!',
  });
  console.log(`  Status: ${correctPassRes.status}`);
  if (correctPassRes.status !== 200) throw new Error(`Expected 200, got ${correctPassRes.status}`);
  console.log(`  ✅  Password changed successfully\n`);

  // Verify must_change_password is now false
  const { data: updatedProfile } = await supabase
    .from('profiles')
    .select('must_change_password')
    .eq('id', throwaway.id)
    .single();
  console.log(`  ✅  must_change_password is now: ${updatedProfile?.must_change_password} (expected: false)\n`);

  // ── Test 5: PATCH /api/account/phone ───────────────────────────────────
  console.log('5️⃣   PATCH /api/account/phone…');
  const phoneRes = await api('PATCH', '/account/phone', throwawayToken, {
    newPhoneNumber: '+255744444444',
  });
  console.log(`  Status: ${phoneRes.status}`);
  if (phoneRes.status !== 200) throw new Error(`Expected 200, got ${phoneRes.status}`);
  console.log(`  ✅  Phone number updated\n`);

  // Verify phone number changed
  const { data: phoneProfile } = await supabase
    .from('profiles')
    .select('phone_number')
    .eq('id', throwaway.id)
    .single();
  console.log(`  ✅  Phone number is now: ${phoneProfile?.phone_number} (expected: +255744444444)\n`);

  // ── Test 6: DELETE /api/account (deactivate own account) ────────────────
  console.log('6️⃣   DELETE /api/account (self-deactivation)…');
  const deleteRes = await api('DELETE', '/account', throwawayToken);
  console.log(`  Status: ${deleteRes.status}`);
  if (deleteRes.status !== 200) throw new Error(`Expected 200, got ${deleteRes.status}`);
  console.log(`  ✅  Account deactivated\n`);

  // Verify is_active is now false
  const { data: deactivatedProfile } = await supabase
    .from('profiles')
    .select('is_active')
    .eq('id', throwaway.id)
    .single();
  console.log(`  ✅  is_active is now: ${deactivatedProfile?.is_active} (expected: false)\n`);

  // ── Test 7: Verify deactivated account cannot login ───────────────────────
  console.log('7️⃣   Attempting to login with deactivated account…');
  try {
    await login(throwawayId, 'NewPassword456!');
    throw new Error('Login should have failed for deactivated account');
  } catch (err: any) {
    if (err.message === 'Account is deactivated') {
      console.log(`  ✅  Correctly blocked: ${err.message}\n`);
    } else {
      throw err;
    }
  }

  console.log('─────────────────────────────────────────────────────────────');
  console.log('🎉  ALL STEP 8 ANALYTICS & ACCOUNT TESTS PASSED!');
  console.log('─────────────────────────────────────────────────────────────\n');
}

run().catch((err) => {
  console.error('\n❌  Test failed:', err.message ?? err);
  process.exit(1);
});
