/**
 * scripts/testCommissions.ts — Step 7 verification
 *
 * Prerequisites:
 *  1. Dev server running  (npm -w api run dev)
 *  2. seed:catalog run    (npm -w api run seed:catalog)
 *  3. At least 2 sellers exist, where one refers the other (referred_by set)
 *
 * Run:
 *   npm -w api run test:commissions
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
  console.log('🧪  Step 7 — Commissions verification\n');

  // ── Tokens ────────────────────────────────────────────────────────────────
  console.log('🔑  Logging in as admin…');
  const { token: adminToken } = await login('ADMIN-001', 'ChangeMe123!');
  console.log(`  ✅  Admin token: ${adminToken.slice(0, 30)}…\n`);

  // ── Setup: Create recruiter and buyer sellers ───────────────────────────────
  console.log('👥  Setting up test sellers (recruiter + buyer)…');

  const { data: tzCountry } = await supabase
    .from('countries')
    .select('id')
    .eq('iso_code', 'TZ')
    .single();
  if (!tzCountry) throw new Error('Tanzania not seeded — run seed:catalog first');
  const tzId = tzCountry.id as string;

  // Generate unique IDs for this test run to avoid conflicts
  const timestamp = Date.now().toString().slice(-4);
  const recruiterId = `BF-TZ-REC${timestamp}`;
  const buyerId = `BF-TZ-BUY${timestamp}`;

  // Clean up any existing sellers with these IDs (unlikely but possible)
  for (const distId of [recruiterId, buyerId]) {
    const { data: existing } = await supabase
      .from('profiles')
      .select('id')
      .eq('distributor_id', distId)
      .maybeSingle();
    if (existing) {
      console.log(`  Cleaning up existing seller: ${distId}`);
      await supabase.auth.admin.deleteUser(existing.id);
      await supabase.from('profiles').delete().eq('id', existing.id);
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  // Create recruiter (no referred_by - top level)
  const recruiterRes = await api('POST', '/sellers', adminToken, {
    distributorId: recruiterId,
    fullName: 'Recruiter Seller',
    phoneNumber: '+255711111111',
    password: 'RecruiterPass123!',
    countryId: tzId,
  });
  if (recruiterRes.status !== 201) throw new Error(`Failed to create recruiter: ${JSON.stringify(recruiterRes.json)}`);
  const recruiter = recruiterRes.json as any;
  console.log(`  ✅  Recruiter created: ${recruiter.distributorId} (id: ${recruiter.id})`);

  // Create buyer (with referred_by set to recruiter)
  const buyerRes = await api('POST', '/sellers', adminToken, {
    distributorId: buyerId,
    fullName: 'Buyer Seller',
    phoneNumber: '+255722222222',
    password: 'BuyerPass123!',
    countryId: tzId,
    referredBy: recruiter.id,
  });
  if (buyerRes.status !== 201) throw new Error(`Failed to create buyer: ${JSON.stringify(buyerRes.json)}`);
  const buyer = buyerRes.json as any;
  console.log(`  ✅  Buyer created: ${buyer.distributorId} (referred_by: ${recruiter.distributorId})\n`);

  // Login as buyer
  const { token: buyerToken } = await login(buyerId, 'BuyerPass123!');
  console.log(`  ✅  Buyer logged in\n`);

  // ── Fetch products ─────────────────────────────────────────────────────────
  const { data: products } = await supabase
    .from('product_prices')
    .select('product_id, price')
    .eq('country_id', tzId)
    .eq('is_available', true)
    .limit(1);

  if (!products || products.length < 1) {
    throw new Error('No products priced in Tanzania — run seed:catalog first');
  }
  console.log(`📦  Found product for testing\n`);

  // ── Test 1: Create order and confirm payment ───────────────────────────────
  console.log('1️⃣   Creating order as buyer…');
  const orderRes = await api('POST', '/orders', buyerToken, {
    countryId: tzId,
    items: [{ productId: products[0].product_id, quantity: 2 }],
  });
  if (orderRes.status !== 201) throw new Error(`Failed to create order: ${JSON.stringify(orderRes.json)}`);
  const order = orderRes.json as any;
  console.log(`  ✅  Order created: ${order.id}, total: ${order.totalAmount}\n`);

  console.log('2️⃣   Submitting payment…');
  const payRes = await api('POST', '/payments/bank', buyerToken, {
    orderId: order.id,
    referenceNo: 'COMM-TEST-001',
  });
  if (payRes.status !== 201) throw new Error(`Failed to submit payment: ${JSON.stringify(payRes.json)}`);
  const payment = payRes.json as any;
  console.log(`  ✅  Payment created: ${payment.id}\n`);

  console.log('3️⃣   Admin confirms payment…');
  const confirmRes = await api('PATCH', `/payments/${payment.id}/confirm`, adminToken);
  if (confirmRes.status !== 200) throw new Error(`Failed to confirm: ${JSON.stringify(confirmRes.json)}`);
  console.log(`  ✅  Payment confirmed\n`);

  // ── Test 2: Verify commission was created for recruiter ─────────────────────
  console.log('4️⃣   Checking commission creation for recruiter…');
  const { data: commissions } = await supabase
    .from('commissions')
    .select('id, amount, level, beneficiary_id, sales!inner(order_id, amount)')
    .eq('beneficiary_id', recruiter.id);

  if (!commissions || commissions.length === 0) {
    throw new Error('No commission created for recruiter!');
  }
  console.log(`  ✅  Commission found: ${commissions[0].id}`);
  console.log(`  ✅  Amount: ${commissions[0].amount}`);
  console.log(`  ✅  Level: ${commissions[0].level}`);
  
  const expectedCommission = order.totalAmount * 0.10; // 10%
  if (Math.abs(Number(commissions[0].amount) - expectedCommission) > 0.01) {
    throw new Error(`Commission amount mismatch: got ${commissions[0].amount}, expected ${expectedCommission}`);
  }
  console.log(`  ✅  Commission amount correct (10% of ${order.totalAmount})\n`);

  // ── Test 3: GET /api/commissions as recruiter ─────────────────────────────
  console.log('5️⃣   GET /api/commissions as recruiter…');
  const { token: recruiterToken } = await login(recruiterId, 'RecruiterPass123!');
  const commissionsRes = await api('GET', '/commissions', recruiterToken);
  if (commissionsRes.status !== 200) throw new Error(`Failed to fetch commissions: ${JSON.stringify(commissionsRes.json)}`);
  const myCommissions = commissionsRes.json as any[];
  console.log(`  ✅  Retrieved ${myCommissions.length} commission(s)`);
  const foundCommission = myCommissions.find((c: any) => c.id === commissions[0].id);
  if (!foundCommission) throw new Error('Commission not found in recruiter list');
  console.log(`  ✅  Commission found in recruiter's list\n`);

  // ── Test 4: GET /api/commissions/summary ───────────────────────────────────
  console.log('6️⃣   GET /api/commissions/summary as recruiter…');
  const summaryRes = await api('GET', '/commissions/summary', recruiterToken);
  if (summaryRes.status !== 200) throw new Error(`Failed to fetch summary: ${JSON.stringify(summaryRes.json)}`);
  const summary = summaryRes.json as any;
  console.log(`  ✅  Month: ${summary.month}`);
  console.log(`  ✅  Total commission: ${summary.total_commission}`);
  console.log(`  ✅  Commission count: ${summary.commission_count}`);
  
  if (Math.abs(summary.total_commission - expectedCommission) > 0.01) {
    throw new Error(`Summary total mismatch: got ${summary.total_commission}, expected ${expectedCommission}`);
  }
  console.log(`  ✅  Summary total matches expected commission\n`);

  // ── Test 5: Order with referred_by = null (no commission) ───────────────────
  console.log('7️⃣   Testing order with referred_by=null (recruiter as buyer)…');
  
  // Recruiter buys something (they have no recruiter)
  const recruiterOrderRes = await api('POST', '/orders', recruiterToken, {
    countryId: tzId,
    items: [{ productId: products[0].product_id, quantity: 1 }],
  });
  if (recruiterOrderRes.status !== 201) throw new Error(`Failed to create recruiter order: ${JSON.stringify(recruiterOrderRes.json)}`);
  const recruiterOrder = recruiterOrderRes.json as any;
  console.log(`  ✅  Recruiter order created: ${recruiterOrder.id}\n`);

  console.log('8️⃣   Submitting and confirming recruiter payment…');
  const recruiterPayRes = await api('POST', '/payments/bank', recruiterToken, {
    orderId: recruiterOrder.id,
    referenceNo: 'COMM-TEST-002',
  });
  if (recruiterPayRes.status !== 201) throw new Error(`Failed: ${JSON.stringify(recruiterPayRes.json)}`);
  const recruiterPayment = recruiterPayRes.json as any;

  const recruiterConfirmRes = await api('PATCH', `/payments/${recruiterPayment.id}/confirm`, adminToken);
  if (recruiterConfirmRes.status !== 200) throw new Error(`Failed: ${JSON.stringify(recruiterConfirmRes.json)}`);
  console.log(`  ✅  Recruiter payment confirmed\n`);

  console.log('9️⃣   Verifying NO commission was created for recruiter order…');
  const { data: recruiterCommissions } = await supabase
    .from('commissions')
    .select('id')
    .eq('beneficiary_id', recruiter.id);
  
  // Should still only have 1 commission (from the buyer's order)
  if (!recruiterCommissions || recruiterCommissions.length !== 1) {
    throw new Error(`Expected exactly 1 commission for recruiter, got ${recruiterCommissions?.length}`);
  }
  console.log(`  ✅  No additional commission created (correct - recruiter has no referred_by)\n`);

  console.log('─────────────────────────────────────────────────────────────');
  console.log('🎉  ALL STEP 7 COMMISSION TESTS PASSED!');
  console.log('─────────────────────────────────────────────────────────────\n');
}

run().catch((err) => {
  console.error('\n❌  Test failed:', err.message ?? err);
  process.exit(1);
});
