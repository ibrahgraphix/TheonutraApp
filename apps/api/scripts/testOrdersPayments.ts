/**
 * scripts/testOrdersPayments.ts — Step 6 verification
 *
 * Prerequisites:
 *  1. Dev server running  (npm -w api run dev)
 *  2. seed:catalog run    (npm -w api run seed:catalog)
 *  3. The `payments` table has provider + phone_number columns.
 *     If not, run this in the Supabase SQL Editor first:
 *       ALTER TABLE public.payments
 *         ADD COLUMN IF NOT EXISTS provider     text,
 *         ADD COLUMN IF NOT EXISTS phone_number text;
 *
 * Run:
 *   npm -w api run test:orders
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
  console.log('🧪  Step 6 — Orders & Payments verification\n');

  // ── Column migration check ────────────────────────────────────────────────
  console.log('🔍  Checking payments table has provider + phone_number columns…');
  const { error: colCheck } = await supabase
    .from('payments')
    .select('provider, phone_number')
    .limit(0);

  if (colCheck) {
    console.error('\n❌  MIGRATION REQUIRED — run the following in Supabase SQL Editor:');
    console.error('\n    ALTER TABLE public.payments');
    console.error('      ADD COLUMN IF NOT EXISTS provider     text,');
    console.error('      ADD COLUMN IF NOT EXISTS phone_number text;\n');
    console.error('    Then re-run this test.\n');
    process.exit(1);
  }
  console.log('  ✅  provider + phone_number columns present\n');

  // ── Tokens ────────────────────────────────────────────────────────────────
  console.log('🔑  Logging in…');
  const { token: adminToken } = await login('ADMIN-001', 'ChangeMe123!');
  console.log(`  ✅  Admin token: ${adminToken.slice(0, 30)}…`);

  // Try both known seller passwords
  let sellerToken: string;
  try {
    sellerToken = (await login('BF-TZ-99999', 'NewSellerPass123!')).token;
  } catch {
    sellerToken = (await login('BF-TZ-99999', 'SellerPass123!')).token;
  }
  console.log(`  ✅  Seller token: ${sellerToken.slice(0, 30)}…\n`);

  // ── Fetch Tanzania ID + products ──────────────────────────────────────────
  const { data: tzCountry } = await supabase
    .from('countries')
    .select('id')
    .eq('iso_code', 'TZ')
    .single();
  if (!tzCountry) throw new Error('Tanzania not seeded — run seed:catalog first');
  const tzId = tzCountry.id as string;
  console.log(`🌍  Tanzania ID: ${tzId}`);

  const { data: products } = await supabase
    .from('product_prices')
    .select('product_id, price')
    .eq('country_id', tzId)
    .eq('is_available', true)
    .limit(2);

  if (!products || products.length < 1) {
    throw new Error('No products priced in Tanzania — run seed:catalog first');
  }
  console.log(`📦  Found ${products.length} product(s) priced in TZ\n`);

  // ── Test 1: POST /api/orders — create order ───────────────────────────────
  console.log('1️⃣   POST /api/orders — create order with 2 items…');

  const item1 = { productId: products[0].product_id as string, quantity: 2 };
  const item2 = products.length > 1
    ? { productId: products[1].product_id as string, quantity: 1 }
    : null;

  const expectedTotal = Number(products[0].price) * 2 +
    (item2 ? Number(products[1].price) * 1 : 0);

  const createOrderRes = await api('POST', '/orders', sellerToken, {
    countryId: tzId,
    items: item2 ? [item1, item2] : [item1],
  });

  console.log(`  Status: ${createOrderRes.status}`);
  if (createOrderRes.status !== 201) {
    throw new Error(`Failed to create order: ${JSON.stringify(createOrderRes.json)}`);
  }

  const order = createOrderRes.json as any;
  console.log(`  ✅  Order created: ${order.id}`);
  console.log(`  ✅  Status: ${order.status} (expected: pending)`);
  console.log(`  ✅  Total: ${order.totalAmount} (expected: ${expectedTotal}) — server-calculated, not client-trusted`);
  console.log(`  ✅  Currency: ${order.currencyCode}`);

  if (order.status !== 'pending') throw new Error('Order should be pending');
  if (order.totalAmount !== expectedTotal) throw new Error(`Total mismatch: got ${order.totalAmount}, expected ${expectedTotal}`);
  console.log();

  // ── Test 2: GET /api/orders/:id — seller can see own order ───────────────
  console.log('2️⃣   GET /api/orders/:id — seller views own order…');
  const getOrderRes = await api('GET', `/orders/${order.id}`, sellerToken);
  console.log(`  Status: ${getOrderRes.status}`);
  if (getOrderRes.status !== 200) throw new Error(`Expected 200, got ${getOrderRes.status}`);
  console.log(`  ✅  Order retrieved, ${(getOrderRes.json as any).items?.length} item(s)\n`);

  // ── Test 3: POST /api/payments/bank — submit payment ─────────────────────
  console.log('3️⃣   POST /api/payments/bank — submit bank payment reference…');
  const bankPayRes = await api('POST', '/payments/bank', sellerToken, {
    orderId:     order.id,
    referenceNo: 'TZBANK-TEST-00123',
  });
  console.log(`  Status: ${bankPayRes.status}`);
  if (bankPayRes.status !== 201) {
    throw new Error(`Failed to submit bank payment: ${JSON.stringify(bankPayRes.json)}`);
  }
  const payment = bankPayRes.json as any;
  console.log(`  ✅  Payment created: ${payment.id}`);
  console.log(`  ✅  isConfirmed: ${payment.isConfirmed} (expected: false)`);
  console.log(`  ✅  method: ${payment.method}`);
  console.log(`  ✅  referenceNo: ${payment.referenceNo}`);
  if (payment.isConfirmed !== false) throw new Error('Payment should not be confirmed yet');
  console.log();

  // ── Test 4: GET /api/payments/pending — admin sees it ────────────────────
  console.log('4️⃣   GET /api/payments/pending as admin…');
  const pendingRes = await api('GET', '/payments/pending', adminToken);
  console.log(`  Status: ${pendingRes.status}`);
  if (pendingRes.status !== 200) throw new Error(`Expected 200, got ${pendingRes.status}`);
  const pending = pendingRes.json as any[];
  const foundPending = pending.find((p: any) => p.id === payment.id);
  if (!foundPending) throw new Error('Payment not found in pending list');
  console.log(`  ✅  ${pending.length} pending payment(s) in system`);
  console.log(`  ✅  Our payment (${payment.id}) found in list`);
  console.log(`  ✅  buyerName: ${foundPending.buyerName}`);
  console.log(`  ✅  distributorId: ${foundPending.distributorId}`);
  console.log();

  // ── Test 5: GET /api/payments/pending — seller gets 403 ──────────────────
  console.log('5️⃣   GET /api/payments/pending as seller → must be 403…');
  const sellerPendingRes = await api('GET', '/payments/pending', sellerToken);
  console.log(`  Status: ${sellerPendingRes.status}`);
  if (sellerPendingRes.status !== 403) throw new Error(`Expected 403, got ${sellerPendingRes.status}`);
  console.log('  ✅  403 correctly returned — seller cannot see pending payments\n');

  // ── Test 6: PATCH /api/payments/:id/confirm — admin confirms ─────────────
  console.log('6️⃣   PATCH /api/payments/:id/confirm as admin…');
  const confirmRes = await api('PATCH', `/payments/${payment.id}/confirm`, adminToken);
  console.log(`  Status: ${confirmRes.status}`);
  if (confirmRes.status !== 200) {
    throw new Error(`Failed to confirm payment: ${JSON.stringify(confirmRes.json)}`);
  }
  console.log(`  ✅  ${(confirmRes.json as any).message}`);

  // Verify order is now paid
  const confirmedOrderRes = await api('GET', `/orders/${order.id}`, sellerToken);
  const confirmedOrder = confirmedOrderRes.json as any;
  console.log(`  ✅  Order status: ${confirmedOrder.status} (expected: paid)`);
  if (confirmedOrder.status !== 'paid') throw new Error('Order should be paid after confirmation');

  // Verify sales row was created
  const { data: saleRow } = await supabase
    .from('sales')
    .select('id, amount, distributor_id')
    .eq('order_id', order.id)
    .maybeSingle();

  if (!saleRow) throw new Error('No sales row was created for this order!');
  console.log(`  ✅  Sale row created: ${saleRow.id}`);
  console.log(`  ✅  Sale amount: ${saleRow.amount} (expected: ${expectedTotal})`);
  console.log();

  // ── Test 7: Confirm same payment again — must fail ────────────────────────
  console.log('7️⃣   PATCH /api/payments/:id/confirm again — must fail gracefully…');
  const doubleConfirmRes = await api('PATCH', `/payments/${payment.id}/confirm`, adminToken);
  console.log(`  Status: ${doubleConfirmRes.status}`);
  if (doubleConfirmRes.status !== 422) {
    throw new Error(`Expected 422 for double-confirm, got ${doubleConfirmRes.status}`);
  }
  console.log(`  ✅  422 returned: ${(doubleConfirmRes.json as any).message}`);

  // Verify no duplicate sales row
  const { data: salesRows } = await supabase
    .from('sales')
    .select('id')
    .eq('order_id', order.id);
  console.log(`  ✅  Sales rows for this order: ${salesRows?.length} (expected exactly 1)`);
  if ((salesRows?.length ?? 0) !== 1) throw new Error('Duplicate sales row detected!');
  console.log();

  // ── Test 8: Create second order and test reject flow ─────────────────────
  console.log('8️⃣   Creating second order to test reject flow…');
  const order2Res = await api('POST', '/orders', sellerToken, {
    countryId: tzId,
    items: [{ productId: products[0].product_id, quantity: 1 }],
  });
  if (order2Res.status !== 201) throw new Error(`Failed: ${JSON.stringify(order2Res.json)}`);
  const order2 = order2Res.json as any;

  const bankPay2Res = await api('POST', '/payments/bank', sellerToken, {
    orderId:     order2.id,
    referenceNo: 'TZBANK-TEST-REJECT',
  });
  if (bankPay2Res.status !== 201) throw new Error(`Failed: ${JSON.stringify(bankPay2Res.json)}`);
  const payment2 = bankPay2Res.json as any;

  const rejectRes = await api('PATCH', `/payments/${payment2.id}/reject`, adminToken);
  console.log(`  Status: ${rejectRes.status}`);
  if (rejectRes.status !== 200) throw new Error(`Expected 200, got ${rejectRes.status}: ${JSON.stringify(rejectRes.json)}`);
  console.log(`  ✅  ${(rejectRes.json as any).message}`);

  const rejectedOrderRes = await api('GET', `/orders/${order2.id}`, sellerToken);
  const rejectedOrder = rejectedOrderRes.json as any;
  console.log(`  ✅  Order status: ${rejectedOrder.status} (expected: cancelled)\n`);
  if (rejectedOrder.status !== 'cancelled') throw new Error('Order should be cancelled');

  // ── Test 9: GET /api/orders — list my orders ─────────────────────────────
  console.log('9️⃣   GET /api/orders — list my orders as seller…');
  const listRes = await api('GET', '/orders', sellerToken);
  console.log(`  Status: ${listRes.status}`);
  if (listRes.status !== 200) throw new Error(`Expected 200, got ${listRes.status}`);
  const myOrders = listRes.json as any[];
  console.log(`  ✅  ${myOrders.length} order(s) returned`);
  const paidFound   = myOrders.find((o: any) => o.id === order.id && o.status === 'paid');
  const cancelFound = myOrders.find((o: any) => o.id === order2.id && o.status === 'cancelled');
  if (!paidFound)   throw new Error('Paid order not found in my orders list');
  if (!cancelFound) throw new Error('Cancelled order not found in my orders list');
  console.log('  ✅  Both test orders found (paid + cancelled)\n');

  console.log('─────────────────────────────────────────────────────────────');
  console.log('🎉  ALL STEP 6 VERIFICATION TESTS PASSED!');
  console.log('─────────────────────────────────────────────────────────────\n');
}

run().catch((err) => {
  console.error('\n❌  Test failed:', err.message ?? err);
  process.exit(1);
});
