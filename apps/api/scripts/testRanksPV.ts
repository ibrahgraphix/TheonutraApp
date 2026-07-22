/**
 * scripts/testRanksPV.ts — Step 12 verification
 *
 * Prerequisites:
 *  1. Dev server running (npm -w api run dev)
 *
 * Run:
 *   npm -w api run test:ranks
 */

import '../src/config/env.js';
import { login } from '../src/services/auth.service.js';
import { supabase } from '../src/config/supabase.js';

const PORT = process.env['PORT'] || 3001;
const BASE = `http://localhost:${PORT}/api`;

async function api(
  method: string,
  path: string,
  token: string,
  body?: unknown,
): Promise<{ status: number; json: any }> {
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

async function run() {
  console.log('🧪  Step 12 — Ranks & PV Verification\n');

  // ── Admin login ───────────────────────────────────────────────────────────
  console.log('🔑  Logging in as admin…');
  const { token: adminToken } = await login('ADMIN-001', 'ChangeMe123!');
  console.log(`  ✅  Admin token: ${adminToken.slice(0, 30)}…`);

  // ── Country ───────────────────────────────────────────────────────────────
  const { data: tzCountry } = await supabase
    .from('countries')
    .select('id')
    .eq('iso_code', 'TZ')
    .single();
  if (!tzCountry) throw new Error('Tanzania not seeded — run seed:catalog first');
  const tzId = tzCountry.id as string;
  console.log(`  ✅  Tanzania ID: ${tzId}`);

  // ── Ensure test seller BF-TZ-99999 exists ────────────────────────────────
  const { data: existingProfile } = await supabase
    .from('profiles')
    .select('id')
    .eq('distributor_id', 'BF-TZ-99999')
    .maybeSingle();

  let sellerId: string;
  if (!existingProfile) {
    console.log('\n🏗️   Creating test seller BF-TZ-99999…');
    const res = await api('POST', '/sellers', adminToken, {
      distributorId: 'BF-TZ-99999',
      fullName:      'John Doe Seller',
      phoneNumber:   '+255712345678',
      password:      'SellerPass123!',
      countryId:     tzId,
    });
    if (res.status !== 201) {
      throw new Error(`Failed to create test seller: ${res.status} ${JSON.stringify(res.json)}`);
    }
    sellerId = res.json.id as string;
    console.log(`  ✅  Created BF-TZ-99999 (id: ${sellerId})`);
  } else {
    sellerId = existingProfile.id as string;
    console.log(`\n  ℹ️   BF-TZ-99999 already exists (id: ${sellerId})`);
  }

  // ── Seller login (try both known passwords, reset if needed) ─────────────
  let sellerToken: string;
  let loggedIn = false;
  for (const pw of ['NewSellerPass123!', 'SellerPass123!']) {
    try {
      sellerToken = (await login('BF-TZ-99999', pw)).token;
      loggedIn = true;
      break;
    } catch { /* try next */ }
  }
  if (!loggedIn!) {
    console.log('  ⚠️   All known passwords failed — resetting via admin…');
    const resetRes = await api('POST', `/sellers/${sellerId}/reset-password`, adminToken, {
      newPassword: 'SellerPass123!',
    });
    if (resetRes.status !== 200) {
      throw new Error(`Password reset failed: ${resetRes.status} ${JSON.stringify(resetRes.json)}`);
    }
    sellerToken = (await login('BF-TZ-99999', 'SellerPass123!')).token;
    loggedIn = true;
  }
  console.log(`  ✅  Seller token: ${sellerToken!.slice(0, 30)}…\n`);

  // ─────────────────────────────────────────────────────────────────────────
  // TEST 1 — GET /api/ranks returns all 6 seeded ranks in level_order
  // ─────────────────────────────────────────────────────────────────────────
  console.log('1️⃣   GET /api/ranks — verifying the rank ladder…');
  const ranksRes = await api('GET', '/ranks', sellerToken!);
  console.log(`  Status: ${ranksRes.status}`);
  if (ranksRes.status !== 200) {
    throw new Error(`Expected 200, got ${ranksRes.status}: ${JSON.stringify(ranksRes.json)}`);
  }
  const ranks = ranksRes.json as any[];
  if (ranks.length !== 6) {
    throw new Error(`Expected 6 ranks, found ${ranks.length}`);
  }
  const expectedRanks = ['Member', 'Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond'];
  for (let i = 0; i < 6; i++) {
    console.log(`      Rank ${i}: ${ranks[i].name} (level_order: ${ranks[i].level_order})`);
    if (ranks[i].name !== expectedRanks[i]) {
      throw new Error(`Expected rank[${i}] = ${expectedRanks[i]}, got ${ranks[i].name}`);
    }
  }
  console.log('  ✅  All 6 ranks present and ordered correctly\n');

  // ─────────────────────────────────────────────────────────────────────────
  // TEST 2 — Update a product's PV via PATCH /api/products/:id
  // ─────────────────────────────────────────────────────────────────────────
  console.log('2️⃣   Updating a product with a PV value…');
  const { data: product } = await supabase
    .from('products')
    .select('id, name, pv')
    .eq('is_active', true)
    .limit(1)
    .single();
  if (!product) throw new Error('No active products found — run seed:catalog first');

  const testPV = 75;
  const updateProductRes = await api('PATCH', `/products/${product.id}`, adminToken, { pv: testPV });
  console.log(`  Status: ${updateProductRes.status}`);
  if (updateProductRes.status !== 200) {
    throw new Error(`Failed to update product PV: ${JSON.stringify(updateProductRes.json)}`);
  }
  if (updateProductRes.json.pv !== testPV) {
    throw new Error(`Expected pv=${testPV}, got ${updateProductRes.json.pv}`);
  }
  console.log(`  ✅  Product "${product.name}" PV updated to ${testPV}\n`);

  // ─────────────────────────────────────────────────────────────────────────
  // TEST 3 — Place + confirm order → GET /api/ranks/me shows correct personal PV
  // ─────────────────────────────────────────────────────────────────────────
  console.log('3️⃣   Placing and confirming an order with the PV product…');

  const progressBefore = await api('GET', '/ranks/me', sellerToken!);
  const pvBefore = progressBefore.json?.personalPV ?? 0;
  console.log(`  Personal PV before order: ${pvBefore}`);

  // Create order
  const orderRes = await api('POST', '/orders', sellerToken!, {
    countryId: tzId,
    items: [{ productId: product.id, quantity: 2 }],
  });
  if (orderRes.status !== 201) throw new Error(`Failed to create order: ${JSON.stringify(orderRes.json)}`);
  const order = orderRes.json;
  console.log(`  ✅  Order created: ${order.id}`);

  // Submit bank payment
  const payRes = await api('POST', '/payments/bank', sellerToken!, {
    orderId: order.id,
    referenceNo: `PVTEST-${Date.now()}`,
  });
  if (payRes.status !== 201) throw new Error(`Failed to submit payment: ${JSON.stringify(payRes.json)}`);
  const payment = payRes.json;
  console.log(`  ✅  Payment submitted: ${payment.id}`);

  // Admin confirms payment
  const confirmRes = await api('PATCH', `/payments/${payment.id}/confirm`, adminToken);
  if (confirmRes.status !== 200) throw new Error(`Failed to confirm payment: ${JSON.stringify(confirmRes.json)}`);
  console.log('  ✅  Payment confirmed');

  // Verify PV increase
  const progressAfter = await api('GET', '/ranks/me', sellerToken!);
  const pvAfter = progressAfter.json?.personalPV ?? 0;
  const expectedPV = pvBefore + 2 * testPV;
  console.log(`  Personal PV after:  ${pvAfter}  (expected ${expectedPV})`);
  console.log(`  Rank progress: currentRank=${progressAfter.json?.currentRank?.name}, nextRank=${progressAfter.json?.nextRank?.name}`);
  if (pvAfter !== expectedPV) {
    throw new Error(`PV mismatch: expected ${expectedPV}, got ${pvAfter}`);
  }
  console.log('  ✅  Personal PV is correct!\n');

  // ─────────────────────────────────────────────────────────────────────────
  // TEST 4 — Admin promotes distributor to Bronze, verify profile + audit log
  // ─────────────────────────────────────────────────────────────────────────
  console.log('4️⃣   Promoting distributor to Bronze…');
  const bronzeRank = ranks.find((r) => r.name === 'Bronze');
  if (!bronzeRank) throw new Error('Bronze rank not found');

  const promoteRes = await api('PATCH', `/ranks/${sellerId}/promote`, adminToken, {
    newRankId: bronzeRank.id,
  });
  console.log(`  Status: ${promoteRes.status}`);
  if (promoteRes.status !== 200) {
    throw new Error(`Failed to promote distributor: ${JSON.stringify(promoteRes.json)}`);
  }

  // Verify profiles.rank_id updated
  const { data: updatedProfile } = await supabase
    .from('profiles')
    .select('rank_id')
    .eq('id', sellerId)
    .single();
  if (updatedProfile?.rank_id !== bronzeRank.id) {
    throw new Error(`Expected rank_id=${bronzeRank.id}, got ${updatedProfile?.rank_id}`);
  }
  console.log('  ✅  profiles.rank_id updated to Bronze');

  // Verify audit log row
  const { data: auditLogs } = await supabase
    .from('audit_logs')
    .select('*')
    .eq('entity_id', sellerId)
    .eq('action', 'rank_promoted')
    .order('created_at', { ascending: false })
    .limit(1);
  if (!auditLogs || auditLogs.length === 0) {
    throw new Error('No audit log entry created for promotion!');
  }
  const logRow = auditLogs[0];
  console.log(`  ✅  Audit log: id=${logRow.id}, action=${logRow.action}, actor=${logRow.actor_id}`);
  if ((logRow.metadata as any)?.newRankId !== bronzeRank.id) {
    throw new Error(`Audit log metadata.newRankId mismatch: expected ${bronzeRank.id}, got ${(logRow.metadata as any)?.newRankId}`);
  }
  console.log('  ✅  Audit log metadata correct\n');

  // ─────────────────────────────────────────────────────────────────────────
  // TEST 5 — Create brand-new seller; verify rank_id defaults to Member
  // ─────────────────────────────────────────────────────────────────────────
  console.log('5️⃣   Creating a brand-new seller to verify Member default rank…');
  const uniqueId = `TEST-RANK-${Date.now()}`;
  const newSellerRes = await api('POST', '/sellers', adminToken, {
    distributorId: uniqueId,
    fullName:      'Test Default Rank Seller',
    phoneNumber:   '+255799999000',
    role:          'distributor',
    countryId:     tzId,
    password:      'Password123!',
  });
  console.log(`  Status: ${newSellerRes.status}`);
  if (newSellerRes.status !== 201) {
    throw new Error(`Failed to create new seller: ${JSON.stringify(newSellerRes.json)}`);
  }
  const newSeller = newSellerRes.json;
  console.log(`  ✅  Seller created: ${newSeller.id}`);
  console.log(`  ✅  rankId in response: ${newSeller.rankId}`);

  const memberRank = ranks.find((r) => r.name === 'Member');
  if (!memberRank) throw new Error('Member rank not found in ranks list');
  if (newSeller.rankId !== memberRank.id) {
    throw new Error(`Expected rankId=${memberRank.id} (Member), got ${newSeller.rankId}`);
  }
  console.log('  ✅  Default rank is Member — correct!\n');

  console.log('─────────────────────────────────────────────────────────────');
  console.log('🎉  ALL STEP 12 VERIFICATION TESTS PASSED!');
  console.log('─────────────────────────────────────────────────────────────\n');
}

run().catch((err) => {
  console.error('\n❌  Test failed:', err.message ?? err);
  process.exit(1);
});
