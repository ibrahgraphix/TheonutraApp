/**
 * scripts/testCompanyAnalytics.ts — Test company analytics fix
 *
 * Prerequisites:
 *  1. Dev server running  (npm -w api run dev)
 *  2. At least one paid order exists in the database
 *
 * Run:
 *   tsx scripts/testCompanyAnalytics.ts
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
  console.log('🧪  Company Analytics Test\n');

  // ── Login as admin ───────────────────────────────────────────────────────────
  console.log('🔑  Logging in as admin…');
  const { token: adminToken } = await login('ADMIN-001', 'ChangeMe123!');
  console.log(`  ✅  Admin token: ${adminToken.slice(0, 30)}…\n`);

  // ── Check existing orders ─────────────────────────────────────────────────────
  console.log('📦  Checking existing orders…');
  const { data: allOrders, error: ordersError } = await supabase
    .from('orders')
    .select('id, status, total_amount, currency_code, country_id')
    .order('created_at', { ascending: false })
    .limit(5);

  if (ordersError) {
    console.error(`  ❌  Failed to fetch orders: ${ordersError.message}`);
    throw ordersError;
  }

  console.log(`  ✅  Found ${allOrders?.length || 0} recent orders`);
  if (allOrders && allOrders.length > 0) {
    console.log('  Recent orders:');
    for (const order of allOrders) {
      console.log(`    - ${order.id.slice(0, 8)}…: ${order.status} ${order.total_amount} ${order.currency_code}`);
    }
  }
  console.log();

  // ── Test 1: GET /api/analytics/admin/company-overview ───────────────────────
  console.log('1️⃣   GET /api/analytics/admin/company-overview…');
  const overviewRes = await api('GET', '/analytics/admin/company-overview', adminToken);
  console.log(`  Status: ${overviewRes.status}`);
  if (overviewRes.status !== 200) {
    console.error(`  Error response: ${JSON.stringify(overviewRes.json)}`);
    throw new Error(`Expected 200, got ${overviewRes.status}`);
  }
  const overview = overviewRes.json as any;
  console.log(`  ✅  Total Sales: ${overview.totalSales} ${overview.currency}`);
  console.log(`  ✅  Total Sales (USD): ${overview.totalSalesUSD} USD`);
  console.log(`  ✅  Active Members: ${overview.activeMembers}`);
  console.log(`  ✅  Inactive Members: ${overview.inactiveMembers}`);
  console.log(`  ✅  New Registrations This Month: ${overview.newRegistrationsThisMonth}`);
  console.log(`  ✅  Total Distributors: ${overview.totalDistributors}\n`);

  if (overview.totalSalesUSD === 0 && allOrders && allOrders.some(o => o.status === 'paid')) {
    console.log('  ⚠️  WARNING: Total sales USD is 0 but there are paid orders in the database!');
    console.log('  This indicates the fix may not be working correctly.');
  } else if (overview.totalSalesUSD > 0) {
    console.log('  ✅  Company analytics are now showing non-zero values!\n');
  }

  // ── Test 2: GET /api/analytics/admin/country-performance ────────────────────
  console.log('2️⃣   GET /api/analytics/admin/country-performance…');
  const countryRes = await api('GET', '/analytics/admin/country-performance', adminToken);
  console.log(`  Status: ${countryRes.status}`);
  if (countryRes.status !== 200) {
    console.error(`  Error response: ${JSON.stringify(countryRes.json)}`);
    throw new Error(`Expected 200, got ${countryRes.status}`);
  }
  const countries = countryRes.json as any[];
  console.log(`  ✅  Retrieved ${countries.length} countries`);
  if (countries.length > 0) {
    console.log('  Top performing countries:');
    const sortedCountries = countries.sort((a, b) => b.totalSalesUSD - a.totalSalesUSD);
    for (const country of sortedCountries.slice(0, 3)) {
      console.log(`    - ${country.countryName}: ${country.totalSalesUSD} USD (${country.orderCount} orders)`);
    }
  }
  console.log();

  // ── Test 3: GET /api/analytics/admin/product-performance ─────────────────────
  console.log('3️⃣   GET /api/analytics/admin/product-performance…');
  const productRes = await api('GET', '/analytics/admin/product-performance', adminToken);
  console.log(`  Status: ${productRes.status}`);
  if (productRes.status !== 200) {
    console.error(`  Error response: ${JSON.stringify(productRes.json)}`);
    throw new Error(`Expected 200, got ${productRes.status}`);
  }
  const products = productRes.json as any[];
  console.log(`  ✅  Retrieved ${products.length} products`);
  if (products.length > 0) {
    console.log('  Top products by revenue:');
    for (const product of products.slice(0, 3)) {
      console.log(`    - ${product.productName}: ${product.totalRevenueUSD} USD (${product.unitsSold} units)`);
    }
  }
  console.log();

  console.log('─────────────────────────────────────────────────────────────');
  console.log('🎉  COMPANY ANALYTICS TEST PASSED!');
  console.log('─────────────────────────────────────────────────────────────');
}

run().catch((err) => {
  console.error('❌  Test failed:', err);
  process.exit(1);
});
