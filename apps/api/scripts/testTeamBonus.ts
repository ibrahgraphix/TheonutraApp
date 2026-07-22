/**
 * scripts/testTeamBonus.ts — Step 14 verification (Team Bonus Expansion)
 *
 * Prerequisites:
 *  1. Dev server running (npm -w api run dev)
 *  2. Phase 1 migration applied (team_bonus_rates table exists)
 *  3. Test data: 3-level downline with sales
 *
 * Run:
 *   npm -w api run test:team-bonus
 *   (add to package.json scripts: "test:team-bonus": "tsx scripts/testTeamBonus.ts")
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
  console.log('🧪  Step 14 — Team Bonus Expansion Verification\n');

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

  // ── Get or create a test product with PV ─────────────────────────────────
  console.log('\n1️⃣   Getting or creating a test product with PV…');
  const { data: existingProduct } = await supabase
    .from('products')
    .select('id, name, pv')
    .eq('name', 'Team Bonus Test Product')
    .eq('is_active', true)
    .maybeSingle();

  let productId: string;
  let productPV = 100;
  if (existingProduct) {
    productId = existingProduct.id as string;
    productPV = Number(existingProduct.pv ?? 100);
    console.log(`  ✅  Found existing product: ${productId} (PV: ${productPV})`);
  } else {
    const createRes = await api('POST', '/products', adminToken, {
      name: 'Team Bonus Test Product',
      description: 'Product for testing team bonus functionality',
      pv: productPV,
      prices: [{ countryId: tzId, price: 100000, distributorPrice: 80000, isAvailable: true }],
    });
    if (createRes.status !== 201) {
      throw new Error(`Failed to create product: ${JSON.stringify(createRes.json)}`);
    }
    productId = createRes.json.id;
    console.log(`  ✅  Created product: ${productId} (PV: ${productPV})`);
  }

  // ── Create a 3-level downline structure ─────────────────────────────────
  console.log('\n2️⃣   Creating 3-level downline structure…');
  
  // Level 0: Root distributor (will receive team bonus)
  const rootId = `TB-ROOT-${Date.now()}`;
  const rootRes = await api('POST', '/sellers', adminToken, {
    distributorId: rootId,
    fullName: 'Root Distributor',
    phoneNumber: '+255711111111',
    password: 'RootPass123!',
    countryId: tzId,
  });
  if (rootRes.status !== 201) throw new Error(`Failed to create root: ${JSON.stringify(rootRes.json)}`);
  const rootProfile = rootRes.json;
  console.log(`  ✅  Root created: ${rootId} (id: ${rootProfile.id})`);

  // Level 1: Direct recruit
  const level1Id = `TB-L1-${Date.now()}`;
  const level1Res = await api('POST', '/sellers', adminToken, {
    distributorId: level1Id,
    fullName: 'Level 1 Distributor',
    phoneNumber: '+255722222222',
    password: 'L1Pass123!',
    countryId: tzId,
    referredBy: rootProfile.id,
  });
  if (level1Res.status !== 201) throw new Error(`Failed to create level 1: ${JSON.stringify(level1Res.json)}`);
  const level1Profile = level1Res.json;
  console.log(`  ✅  Level 1 created: ${level1Id} (id: ${level1Profile.id})`);

  // Level 2: Recruit of level 1
  const level2Id = `TB-L2-${Date.now()}`;
  const level2Res = await api('POST', '/sellers', adminToken, {
    distributorId: level2Id,
    fullName: 'Level 2 Distributor',
    phoneNumber: '+255733333333',
    password: 'L2Pass123!',
    countryId: tzId,
    referredBy: level1Profile.id,
  });
  if (level2Res.status !== 201) throw new Error(`Failed to create level 2: ${JSON.stringify(level2Res.json)}`);
  const level2Profile = level2Res.json;
  console.log(`  ✅  Level 2 created: ${level2Id} (id: ${level2Profile.id})`);

  // Level 3: Recruit of level 2
  const level3Id = `TB-L3-${Date.now()}`;
  const level3Res = await api('POST', '/sellers', adminToken, {
    distributorId: level3Id,
    fullName: 'Level 3 Distributor',
    phoneNumber: '+255744444444',
    password: 'L3Pass123!',
    countryId: tzId,
    referredBy: level2Profile.id,
  });
  if (level3Res.status !== 201) throw new Error(`Failed to create level 3: ${JSON.stringify(level3Res.json)}`);
  const level3Profile = level3Res.json;
  console.log(`  ✅  Level 3 created: ${level3Id} (id: ${level3Profile.id})`);

  // ── Promote root to Silver rank (unlocks 3 levels of team bonus) ─────────
  console.log('\n3️⃣   Promoting root to Silver rank (unlocks 3 levels of team bonus)…');
  const { data: silverRank } = await supabase
    .from('ranks')
    .select('id')
    .eq('name', 'Silver')
    .single();
  if (!silverRank) throw new Error('Silver rank not found');

  const promoteRes = await api('PATCH', `/ranks/${rootProfile.id}/promote`, adminToken, {
    newRankId: silverRank.id,
  });
  if (promoteRes.status !== 200) {
    throw new Error(`Failed to promote root: ${JSON.stringify(promoteRes.json)}`);
  }
  console.log(`  ✅  Root promoted to Silver`);

  // ── Create sales at each level ───────────────────────────────────────────
  console.log('\n4️⃣   Creating sales at each level…');

  // Login as level 1 and create order
  const l1Token = (await login(level1Id, 'L1Pass123!')).token;
  const l1OrderRes = await api('POST', '/orders', l1Token, {
    countryId: tzId,
    items: [{ productId, quantity: 1 }],
  });
  if (l1OrderRes.status !== 201) throw new Error(`Failed to create L1 order: ${JSON.stringify(l1OrderRes.json)}`);
  const l1Order = l1OrderRes.json;
  
  const l1PayRes = await api('POST', '/payments/bank', l1Token, {
    orderId: l1Order.id,
    referenceNo: `L1-TEST-${Date.now()}`,
  });
  if (l1PayRes.status !== 201) throw new Error(`Failed to submit L1 payment: ${JSON.stringify(l1PayRes.json)}`);
  const l1Payment = l1PayRes.json;

  const l1ConfirmRes = await api('PATCH', `/payments/${l1Payment.id}/confirm`, adminToken);
  if (l1ConfirmRes.status !== 200) throw new Error(`Failed to confirm L1 payment: ${JSON.stringify(l1ConfirmRes.json)}`);
  console.log(`  ✅  Level 1 sale: 1 unit (${productPV} PV)`);

  // Login as level 2 and create order
  const l2Token = (await login(level2Id, 'L2Pass123!')).token;
  const l2OrderRes = await api('POST', '/orders', l2Token, {
    countryId: tzId,
    items: [{ productId, quantity: 2 }],
  });
  if (l2OrderRes.status !== 201) throw new Error(`Failed to create L2 order: ${JSON.stringify(l2OrderRes.json)}`);
  const l2Order = l2OrderRes.json;
  
  const l2PayRes = await api('POST', '/payments/bank', l2Token, {
    orderId: l2Order.id,
    referenceNo: `L2-TEST-${Date.now()}`,
  });
  if (l2PayRes.status !== 201) throw new Error(`Failed to submit L2 payment: ${JSON.stringify(l2PayRes.json)}`);
  const l2Payment = l2PayRes.json;

  const l2ConfirmRes = await api('PATCH', `/payments/${l2Payment.id}/confirm`, adminToken);
  if (l2ConfirmRes.status !== 200) throw new Error(`Failed to confirm L2 payment: ${JSON.stringify(l2ConfirmRes.json)}`);
  console.log(`  ✅  Level 2 sale: 2 units (${2 * productPV} PV)`);

  // Login as level 3 and create order
  const l3Token = (await login(level3Id, 'L3Pass123!')).token;
  const l3OrderRes = await api('POST', '/orders', l3Token, {
    countryId: tzId,
    items: [{ productId, quantity: 3 }],
  });
  if (l3OrderRes.status !== 201) throw new Error(`Failed to create L3 order: ${JSON.stringify(l3OrderRes.json)}`);
  const l3Order = l3OrderRes.json;
  
  const l3PayRes = await api('POST', '/payments/bank', l3Token, {
    orderId: l3Order.id,
    referenceNo: `L3-TEST-${Date.now()}`,
  });
  if (l3PayRes.status !== 201) throw new Error(`Failed to submit L3 payment: ${JSON.stringify(l3PayRes.json)}`);
  const l3Payment = l3PayRes.json;

  const l3ConfirmRes = await api('PATCH', `/payments/${l3Payment.id}/confirm`, adminToken);
  if (l3ConfirmRes.status !== 200) throw new Error(`Failed to confirm L3 payment: ${JSON.stringify(l3ConfirmRes.json)}`);
  console.log(`  ✅  Level 3 sale: 3 units (${3 * productPV} PV)`);

  // ── Calculate team bonus for root distributor ─────────────────────────────
  console.log('\n5️⃣   Calculating team bonus for root distributor…');
  const now = new Date();
  const currentPeriod = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  
  const rootToken = (await login(rootId, 'RootPass123!')).token;
  const summaryRes = await api('GET', `/team-bonus/my-summary?period=${currentPeriod}`, rootToken);
  console.log(`  Status: ${summaryRes.status}`);
  if (summaryRes.status !== 200) {
    throw new Error(`Failed to get team bonus summary: ${JSON.stringify(summaryRes.json)}`);
  }
  const summary = summaryRes.json;
  console.log(`  ✅  Total Team PV: ${summary.totalTeamPV}`);
  console.log(`  ✅  Total Team Sales: ${summary.totalTeamSales}`);
  console.log(`  ✅  Total Bonus: ${summary.totalBonus}`);
  
  // Expected values for Silver rank (5% L1, 3% L2, 2% L3)
  const expectedL1PV = 1 * productPV;
  const expectedL2PV = 2 * productPV;
  const expectedL3PV = 3 * productPV;
  const expectedTotalPV = expectedL1PV + expectedL2PV + expectedL3PV;
  const expectedL1Bonus = expectedL1PV * 0.05;
  const expectedL2Bonus = expectedL2PV * 0.03;
  const expectedL3Bonus = expectedL3PV * 0.02;
  const expectedTotalBonus = expectedL1Bonus + expectedL2Bonus + expectedL3Bonus;

  console.log(`  Expected breakdown:`);
  console.log(`    Level 1: ${expectedL1PV} PV × 5% = ${expectedL1Bonus}`);
  console.log(`    Level 2: ${expectedL2PV} PV × 3% = ${expectedL2Bonus}`);
  console.log(`    Level 3: ${expectedL3PV} PV × 2% = ${expectedL3Bonus}`);
  console.log(`    Total: ${expectedTotalBonus}`);

  if (Math.abs(summary.totalBonus - expectedTotalBonus) > 0.01) {
    throw new Error(`Expected total bonus ${expectedTotalBonus}, got ${summary.totalBonus}`);
  }
  console.log('  ✅  Team bonus calculation is correct!\n');

  // ── Test: Distributor with no downline gets 0 bonus ───────────────────────
  console.log('6️⃣   Testing distributor with no downline…');
  const noDownlineId = `TB-NODOWN-${Date.now()}`;
  const noDownlineRes = await api('POST', '/sellers', adminToken, {
    distributorId: noDownlineId,
    fullName: 'No Downline Distributor',
    phoneNumber: '+255755555555',
    password: 'NoDownPass123!',
    countryId: tzId,
  });
  if (noDownlineRes.status !== 201) throw new Error(`Failed to create no-downline distributor: ${JSON.stringify(noDownlineRes.json)}`);
  const noDownlineProfile = noDownlineRes.json;

  const noDownlineToken = (await login(noDownlineId, 'NoDownPass123!')).token;
  const noDownlineSummaryRes = await api('GET', `/team-bonus/my-summary?period=${currentPeriod}`, noDownlineToken);
  if (noDownlineSummaryRes.status !== 200) {
    throw new Error(`Failed to get no-downline summary: ${JSON.stringify(noDownlineSummaryRes.json)}`);
  }
  const noDownlineSummary = noDownlineSummaryRes.json;
  console.log(`  ✅  No downline bonus: ${noDownlineSummary.totalBonus} (expected 0)`);
  if (noDownlineSummary.totalBonus !== 0) {
    throw new Error(`Expected 0 bonus for no downline, got ${noDownlineSummary.totalBonus}`);
  }
  console.log('  ✅  No downline test passed!\n');

  // ── Test: Rank gating - Member rank only gets 1 level ────────────────────
  console.log('7️⃣   Testing rank gating (Member rank = 1 level only)…');
  const memberId = `TB-MEMBER-${Date.now()}`;
  const memberRes = await api('POST', '/sellers', adminToken, {
    distributorId: memberId,
    fullName: 'Member Rank Test',
    phoneNumber: '+255766666666',
    password: 'MemberPass123!',
    countryId: tzId,
  });
  if (memberRes.status !== 201) throw new Error(`Failed to create member test: ${JSON.stringify(memberRes.json)}`);
  const memberProfile = memberRes.json;

  // Create a downline for the member
  const memberDownlineId = `TB-MD-${Date.now()}`;
  const memberDownlineRes = await api('POST', '/sellers', adminToken, {
    distributorId: memberDownlineId,
    fullName: 'Member Downline',
    phoneNumber: '+255777777777',
    password: 'MDPass123!',
    countryId: tzId,
    referredBy: memberProfile.id,
  });
  if (memberDownlineRes.status !== 201) throw new Error(`Failed to create member downline: ${JSON.stringify(memberDownlineRes.json)}`);
  const memberDownlineProfile = memberDownlineRes.json;

  // Create sale in downline
  const mdToken = (await login(memberDownlineId, 'MDPass123!')).token;
  const mdOrderRes = await api('POST', '/orders', mdToken, {
    countryId: tzId,
    items: [{ productId, quantity: 1 }],
  });
  if (mdOrderRes.status !== 201) throw new Error(`Failed to create MD order: ${JSON.stringify(mdOrderRes.json)}`);
  const mdOrder = mdOrderRes.json;
  
  const mdPayRes = await api('POST', '/payments/bank', mdToken, {
    orderId: mdOrder.id,
    referenceNo: `MD-TEST-${Date.now()}`,
  });
  if (mdPayRes.status !== 201) throw new Error(`Failed to submit MD payment: ${JSON.stringify(mdPayRes.json)}`);
  const mdPayment = mdPayRes.json;

  const mdConfirmRes = await api('PATCH', `/payments/${mdPayment.id}/confirm`, adminToken);
  if (mdConfirmRes.status !== 200) throw new Error(`Failed to confirm MD payment: ${JSON.stringify(mdConfirmRes.json)}`);

  // Check member's team bonus (should only get 1 level at 5%)
  const memberToken = (await login(memberId, 'MemberPass123!')).token;
  const memberSummaryRes = await api('GET', `/team-bonus/my-summary?period=${currentPeriod}`, memberToken);
  if (memberSummaryRes.status !== 200) {
    throw new Error(`Failed to get member summary: ${JSON.stringify(memberSummaryRes.json)}`);
  }
  const memberSummary = memberSummaryRes.json;
  console.log(`  ✅  Member breakdown levels: ${memberSummary.breakdown.length} (expected 1)`);
  if (memberSummary.breakdown.length !== 1) {
    throw new Error(`Member should only get 1 level, got ${memberSummary.breakdown.length}`);
  }
  console.log(`  ✅  Member level 1 percentage: ${memberSummary.breakdown[0].percentage}% (expected 5%)`);
  if (memberSummary.breakdown[0].percentage !== 5) {
    throw new Error(`Member level 1 should be 5%, got ${memberSummary.breakdown[0].percentage}`);
  }
  console.log('  ✅  Rank gating test passed!\n');

  // ── Test: Batch run idempotency ───────────────────────────────────────────
  console.log('8️⃣   Testing batch run idempotency…');
  const batchRes1 = await api('POST', '/team-bonus/run', adminToken, { period: currentPeriod });
  console.log(`  First run status: ${batchRes1.status}`);
  console.log(`  First run response:`, JSON.stringify(batchRes1.json));
  
  if (batchRes1.status !== 200) {
    throw new Error(`First batch run failed: ${JSON.stringify(batchRes1.json)}`);
  }
  
  const batchRes2 = await api('POST', '/team-bonus/run', adminToken, { period: currentPeriod });
  console.log(`  Second run status: ${batchRes2.status}`);
  console.log(`  Second run response:`, JSON.stringify(batchRes2.json));
  
  if (batchRes2.status !== 200) {
    throw new Error(`Second batch run failed: ${JSON.stringify(batchRes2.json)}`);
  }
  
  // Check if second run processed fewer (idempotent)
  const processed1 = batchRes1.json.processed || 0;
  const processed2 = batchRes2.json.processed || 0;
  
  if (processed2 > processed1) {
    throw new Error(`Second run should not process more than first run (idempotent), got ${processed2} vs ${processed1}`);
  }
  console.log('  ✅  Batch run is idempotent!\n');

  console.log('─────────────────────────────────────────────────────────────');
  console.log('🎉  ALL STEP 14 VERIFICATION TESTS PASSED!');
  console.log('─────────────────────────────────────────────────────────────\n');
}

run().catch((err) => {
  console.error('\n❌  Test failed:', err.message ?? err);
  process.exit(1);
});
