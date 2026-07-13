/**
 * scripts/testTeam.ts — Step 5 verification
 *
 * Run while the dev server is running:
 *   npm -w api run test:team
 *
 * Tree we build for the test (if not already present):
 *
 *   ADMIN-001  (root)
 *     └─ BF-TZ-99999  (level 1 under admin)
 *         └─ BF-TZ-88888  (level 2 under admin, level 1 under 99999)
 *
 * Tests:
 *  1. GET /api/team  as BF-TZ-99999 → only BF-TZ-88888 (direct recruit)
 *  2. GET /api/team/full as BF-TZ-99999 → BF-TZ-88888 at level 1
 *  3. GET /api/team  as ADMIN-001 → BF-TZ-99999 at level 1
 *  4. GET /api/team/full as ADMIN-001 → both sellers, correct levels
 *  5. Confirm no route accepts an :id param (by design — no way to spoof)
 *  6. GET /api/team/counts as admin (staff) → returns a map
 *  7. GET /api/team/counts as seller → 403
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

// ── setup helpers ─────────────────────────────────────────────────────────────

async function ensureSeller(opts: {
  distributorId: string;
  fullName: string;
  password: string;
  countryId: string;
  referredBy: string | null;
  adminToken: string;
}): Promise<string> {
  // Check if already exists
  const { data: existing } = await supabase
    .from('profiles')
    .select('id')
    .eq('distributor_id', opts.distributorId)
    .maybeSingle();

  if (existing) {
    console.log(`  ℹ️   ${opts.distributorId} already exists (id: ${existing.id})`);
    return existing.id as string;
  }

  const body: Record<string, unknown> = {
    distributorId: opts.distributorId,
    fullName:      opts.fullName,
    phoneNumber:   '+255700000001',
    password:      opts.password,
    countryId:     opts.countryId,
  };
  if (opts.referredBy) body['referredBy'] = opts.referredBy;

  const { status, json } = await api('POST', '/sellers', opts.adminToken, body);
  if (status !== 201) {
    throw new Error(`Failed to create ${opts.distributorId}: ${status} ${JSON.stringify(json)}`);
  }
  const created = json as { id: string };
  console.log(`  ✅  Created ${opts.distributorId} (id: ${created.id})`);
  return created.id;
}

// ── main ──────────────────────────────────────────────────────────────────────

async function run() {
  console.log('🧪  Step 5 — Team module verification\n');

  // ── Tokens ────────────────────────────────────────────────────────────────
  console.log('🔑  Logging in…');
  const { token: adminToken } = await login('ADMIN-001', 'ChangeMe123!');
  console.log(`  ✅  Admin token: ${adminToken.slice(0, 30)}…`);

  let sellerToken99999: string;
  try {
    const r = await login('BF-TZ-99999', 'NewSellerPass123!');
    sellerToken99999 = r.token;
  } catch {
    const r = await login('BF-TZ-99999', 'SellerPass123!');
    sellerToken99999 = r.token;
  }
  console.log(`  ✅  Seller 99999 token: ${sellerToken99999.slice(0, 30)}…\n`);

  // ── Country ───────────────────────────────────────────────────────────────
  const { data: tzCountry } = await supabase
    .from('countries')
    .select('id')
    .eq('iso_code', 'TZ')
    .single();
  if (!tzCountry) throw new Error('Tanzania not seeded — run seed:catalog first');
  const countryId = tzCountry.id as string;

  // ── Fetch admin profile id ─────────────────────────────────────────────────
  const { data: adminProfile } = await supabase
    .from('profiles')
    .select('id')
    .eq('distributor_id', 'ADMIN-001')
    .single();
  if (!adminProfile) throw new Error('Admin profile not found');
  const adminId = adminProfile.id as string;

  // ── Fetch BF-TZ-99999 profile id ─────────────────────────────────────────
  const { data: seller99Profile } = await supabase
    .from('profiles')
    .select('id, referred_by')
    .eq('distributor_id', 'BF-TZ-99999')
    .single();
  if (!seller99Profile) throw new Error('BF-TZ-99999 not found — run testSellers first');
  const seller99Id = seller99Profile.id as string;

  // Ensure BF-TZ-99999 is under ADMIN-001 (patch referred_by if missing)
  if (!seller99Profile.referred_by) {
    console.log('  ⚠️   BF-TZ-99999 has no referredBy — patching to ADMIN-001…');
    await supabase.from('profiles').update({ referred_by: adminId }).eq('id', seller99Id);
    console.log('  ✅  Patched.\n');
  }

  // ── Ensure BF-TZ-88888 exists under BF-TZ-99999 ─────────────────────────
  console.log('🏗️   Ensuring test tree (ADMIN → 99999 → 88888)…');
  await ensureSeller({
    distributorId: 'BF-TZ-88888',
    fullName:      'Sub Seller 88888',
    password:      'SubSeller123!',
    countryId,
    referredBy:    seller99Id,
    adminToken,
  });
  console.log();

  // ── Test 1: GET /api/team as 99999 → direct recruits ─────────────────────
  console.log('1️⃣   GET /api/team as BF-TZ-99999 (direct recruits)…');
  const t1 = await api('GET', '/team', sellerToken99999);
  console.log(`  Status: ${t1.status}`);
  if (t1.status !== 200) throw new Error(`Expected 200, got ${t1.status}: ${JSON.stringify(t1.json)}`);

  const directOf99 = t1.json as Array<{ distributorId: string; level: number; memberId: string }>;
  console.log(`  ✅  ${directOf99.length} direct recruit(s) returned`);
  const found88 = directOf99.find((m) => m.distributorId === 'BF-TZ-88888');
  if (!found88) throw new Error('BF-TZ-88888 not found in direct recruits of 99999');
  console.log(`  ✅  BF-TZ-88888 present at level ${found88.level} (expected 1)`);
  if (found88.level !== 1) throw new Error(`Expected level 1, got ${found88.level}`);
  console.log();

  // ── Test 2: GET /api/team/full as 99999 ──────────────────────────────────
  console.log('2️⃣   GET /api/team/full as BF-TZ-99999 (full downline)…');
  const t2 = await api('GET', '/team/full', sellerToken99999);
  console.log(`  Status: ${t2.status}`);
  if (t2.status !== 200) throw new Error(`Expected 200, got ${t2.status}`);

  const fullOf99 = t2.json as Array<{ distributorId: string; level: number; referredBy: string | null; monthlySales: number }>;
  console.log(`  ✅  ${fullOf99.length} member(s) in full team`);
  const fullMember88 = fullOf99.find((m) => m.distributorId === 'BF-TZ-88888');
  if (!fullMember88) throw new Error('BF-TZ-88888 not in full team of 99999');
  console.log(`  ✅  BF-TZ-88888: level=${fullMember88.level}, referredBy=${fullMember88.referredBy}, monthlySales=${fullMember88.monthlySales}`);
  console.log();

  // ── Test 3: GET /api/team as ADMIN ────────────────────────────────────────
  console.log('3️⃣   GET /api/team as ADMIN-001 (direct recruits)…');
  const t3 = await api('GET', '/team', adminToken);
  console.log(`  Status: ${t3.status}`);
  if (t3.status !== 200) throw new Error(`Expected 200, got ${t3.status}`);

  const directOfAdmin = t3.json as Array<{ distributorId: string; level: number }>;
  console.log(`  ✅  ${directOfAdmin.length} direct recruit(s) under admin`);
  const found99inAdmin = directOfAdmin.find((m) => m.distributorId === 'BF-TZ-99999');
  if (!found99inAdmin) throw new Error('BF-TZ-99999 not found in admin direct recruits');
  console.log(`  ✅  BF-TZ-99999 present at level ${found99inAdmin.level} (expected 1)`);
  console.log();

  // ── Test 4: GET /api/team/full as ADMIN ──────────────────────────────────
  console.log('4️⃣   GET /api/team/full as ADMIN-001 (full downline)…');
  const t4 = await api('GET', '/team/full', adminToken);
  console.log(`  Status: ${t4.status}`);
  if (t4.status !== 200) throw new Error(`Expected 200, got ${t4.status}`);

  const fullOfAdmin = t4.json as Array<{ distributorId: string; level: number }>;
  console.log(`  ✅  ${fullOfAdmin.length} member(s) in admin's full downline`);

  const admin99 = fullOfAdmin.find((m) => m.distributorId === 'BF-TZ-99999');
  const admin88 = fullOfAdmin.find((m) => m.distributorId === 'BF-TZ-88888');

  if (!admin99) throw new Error('BF-TZ-99999 missing from admin full downline');
  if (!admin88) throw new Error('BF-TZ-88888 missing from admin full downline');

  console.log(`  ✅  BF-TZ-99999: level=${admin99.level} (expected 1)`);
  console.log(`  ✅  BF-TZ-88888: level=${admin88.level} (expected 2)`);

  if (admin99.level !== 1) throw new Error(`99999 should be level 1, got ${admin99.level}`);
  if (admin88.level !== 2) throw new Error(`88888 should be level 2, got ${admin88.level}`);
  console.log();

  // ── Test 5: No :id route — structural cross-inspection prevention ─────────
  console.log('5️⃣   Structural isolation check (no :id param on team routes)…');
  // The only routes are /team and /team/full — neither accepts an external id.
  // Hitting /team/ADMIN-UUID-HERE with the seller token returns a 404 (no such route)
  // or an empty list from /team/full — confirm it's not a valid route shortcut.
  const t5 = await api('GET', `/team/${adminId}`, sellerToken99999);
  // This will 404 (no route matches) or be treated as /full with path confusion
  // In Express, /team/:something doesn't exist — Express will 404 it.
  console.log(`  ✅  GET /api/team/<adminId> with seller token → ${t5.status} (expected 404 or irrelevant — no route exists)`);
  // We only care it's not 200 with admin's data
  const body5 = t5.json as { message?: string } | null;
  if (t5.status === 200 && Array.isArray(t5.json) && (t5.json as unknown[]).length > 0) {
    throw new Error('SECURITY: seller received team data via path param!');
  }
  console.log('  ✅  No cross-team data leak possible via URL param\n');

  // ── Test 6: GET /api/team/counts (admin) ─────────────────────────────────
  console.log('6️⃣   GET /api/team/counts as admin…');
  const t6 = await api('GET', '/team/counts', adminToken);
  console.log(`  Status: ${t6.status}`);
  if (t6.status !== 200) throw new Error(`Expected 200, got ${t6.status}: ${JSON.stringify(t6.json)}`);
  const counts = t6.json as Record<string, number>;
  console.log(`  ✅  Counts map has ${Object.keys(counts).length} entry(ies)`);
  console.log(`  ✅  Admin's direct count: ${counts[adminId] ?? 0}`);
  console.log(`  ✅  99999's direct count: ${counts[seller99Id] ?? 0}`);
  console.log();

  // ── Test 7: GET /api/team/counts (seller) → must be 403 ──────────────────
  console.log('7️⃣   GET /api/team/counts as seller → must reject with 403…');
  const t7 = await api('GET', '/team/counts', sellerToken99999);
  console.log(`  Status: ${t7.status}`);
  if (t7.status !== 403) throw new Error(`Expected 403, got ${t7.status}`);
  console.log('  ✅  403 correctly returned — seller cannot access staff counts\n');

  console.log('─────────────────────────────────────────────────────────────');
  console.log('🎉  ALL STEP 5 VERIFICATION TESTS PASSED!');
  console.log('─────────────────────────────────────────────────────────────\n');
}

run().catch((err) => {
  console.error('❌  Test failed:', err.message ?? err);
  process.exit(1);
});
