/**
 * scripts/testDashboard.ts
 *
 * E2E tests for Step 10: Admin Dashboard
 * Tests dashboard summary and payment detail endpoints.
 *
 * Run:
 *   npm -w api exec tsx -- scripts/testDashboard.ts
 */

import '../src/config/env.js';
import { login } from '../src/services/auth.service.js';

const PORT = process.env.PORT || 3001;
const BASE_URL = `http://localhost:${PORT}/api`;

async function request(path: string, options: RequestInit = {}) {
  const url = `${BASE_URL}${path}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  const text = await response.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }
  return { status: response.status, data: json };
}

async function run() {
  console.log('🧪 Starting Step 10 Admin Dashboard Verification...\n');

  // 1. Log in as admin and seller
  console.log('1. Logging in users...');
  const adminLogin = await login('ADMIN-001', 'ChangeMe123!');
  console.log('✅ Admin logged in.');

  let sellerLogin;
  try {
    sellerLogin = await login('BF-TZ-99999', 'NewSellerPass123!');
  } catch {
    sellerLogin = await login('BF-TZ-99999', 'SellerPass123!');
  }
  console.log('✅ Seller logged in.');

  const adminHeaders = { 'Authorization': `Bearer ${adminLogin.token}` };
  const sellerHeaders = { 'Authorization': `Bearer ${sellerLogin.token}` };

  // ───────────────────────────────────────────────────────────────────────────
  // DASHBOARD SUMMARY TESTS
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n--- Testing Dashboard Summary ---');

  // Test: GET /api/dashboard/summary as admin -> should succeed
  console.log('2. Getting dashboard summary as admin...');
  const summaryAdmin = await request('/dashboard/summary', {
    headers: adminHeaders,
  });
  if (summaryAdmin.status !== 200) {
    throw new Error(`Expected 200 for admin dashboard summary, got ${summaryAdmin.status}: ${JSON.stringify(summaryAdmin.data)}`);
  }
  console.log('✅ Admin dashboard summary retrieved successfully.');
  console.log('   Pending payments count:', summaryAdmin.data.pendingPaymentsCount);
  console.log('   Active sellers count:', summaryAdmin.data.activeSellersCount);
  console.log('   Total sales this month:', summaryAdmin.data.totalSalesThisMonth);
  console.log('   Total commissions this month:', summaryAdmin.data.totalCommissionsPaidThisMonth);

  // Test: GET /api/dashboard/summary as seller -> should be 403
  console.log('3. Getting dashboard summary as seller (should 403)...');
  const summarySeller = await request('/dashboard/summary', {
    headers: sellerHeaders,
  });
  if (summarySeller.status !== 403) {
    throw new Error(`Expected 403 for seller dashboard summary, got ${summarySeller.status}`);
  }
  console.log('✅ Seller dashboard summary correctly rejected with 403.');

  // ───────────────────────────────────────────────────────────────────────────
  // PAYMENT DETAIL TESTS
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n--- Testing Payment Detail ---');

  // Get a pending payment ID from the summary
  const pendingPayments = summaryAdmin.data.pendingPayments;
  if (pendingPayments.length === 0) {
    console.log('⚠️  No pending payments found, skipping payment detail test.');
    console.log('   (This is expected if no orders are awaiting payment confirmation)');
  } else {
    const testPaymentId = pendingPayments[0].id;
    console.log(`4. Getting payment detail for ${testPaymentId}...`);
    const paymentDetail = await request(`/dashboard/payments/${testPaymentId}`, {
      headers: adminHeaders,
    });
    if (paymentDetail.status !== 200) {
      throw new Error(`Expected 200 for payment detail, got ${paymentDetail.status}: ${JSON.stringify(paymentDetail.data)}`);
    }
    console.log('✅ Payment detail retrieved successfully.');
    console.log('   Payment ID:', paymentDetail.data.payment.id);
    console.log('   Order ID:', paymentDetail.data.order.id);
    console.log('   Buyer:', paymentDetail.data.buyer.fullName);
    console.log('   Order items count:', paymentDetail.data.orderItems.length);

    // Test: GET /api/dashboard/payments/:id as seller -> should be 403
    console.log('5. Getting payment detail as seller (should 403)...');
    const paymentDetailSeller = await request(`/dashboard/payments/${testPaymentId}`, {
      headers: sellerHeaders,
    });
    if (paymentDetailSeller.status !== 403) {
      throw new Error(`Expected 403 for seller payment detail, got ${paymentDetailSeller.status}`);
    }
    console.log('✅ Seller payment detail correctly rejected with 403.');
  }

  console.log('\n🎉 ALL STEP 10 DASHBOARD TESTS PASSED! 🎉');
}

run().catch((err) => {
  console.error('\n❌ Test failed:', err);
  process.exit(1);
});
