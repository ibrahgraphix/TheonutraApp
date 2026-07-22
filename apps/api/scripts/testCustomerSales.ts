/**
 * scripts/testCustomerSales.ts — Step 13 verification (Retail Profit)
 *
 * Prerequisites:
 *  1. Dev server running (npm -w api run dev)
 *  2. Database has customer_sales, customer_sale_items tables (Phase 1 migration)
 *  3. product_prices.distributor_price column exists
 *
 * Run:
 *   npm -w api run test:customer-sales
 *   (add to package.json scripts: "test:customer-sales": "tsx scripts/testCustomerSales.ts")
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
  console.log('🧪  Step 13 — Retail Profit Verification\n');

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
  // TEST 1 — Get or create a test product with PV
  // ─────────────────────────────────────────────────────────────────────────
  console.log('1️⃣   Getting or creating a test product with PV…');
  const { data: existingProduct } = await supabase
    .from('products')
    .select('id, name, pv')
    .eq('name', 'Retail Profit Test Product')
    .eq('is_active', true)
    .maybeSingle();

  let productId: string;
  let productPV = 50;
  if (existingProduct) {
    productId = existingProduct.id as string;
    productPV = Number(existingProduct.pv ?? 50);
    console.log(`  ✅  Found existing product: ${productId} (PV: ${productPV})`);
  } else {
    const createRes = await api('POST', '/products', adminToken, {
      name: 'Retail Profit Test Product',
      description: 'Product for testing retail profit functionality',
      pv: productPV,
      prices: [{ countryId: tzId, price: 100000, distributorPrice: 80000, isAvailable: true }],
    });
    if (createRes.status !== 201) {
      throw new Error(`Failed to create product: ${JSON.stringify(createRes.json)}`);
    }
    productId = createRes.json.id;
    console.log(`  ✅  Created product: ${productId} (PV: ${productPV})`);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // TEST 2 — Update product with distributorPrice (customer 100,000 / distributor 80,000)
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n2️⃣   Updating product with distributorPrice…');
  const updateRes = await api('PATCH', `/products/${productId}`, adminToken, {
    prices: [{ countryId: tzId, price: 100000, distributorPrice: 80000, isAvailable: true }],
    pv: productPV,
  });
  console.log(`  Status: ${updateRes.status}`);
  if (updateRes.status !== 200) {
    throw new Error(`Failed to update product: ${JSON.stringify(updateRes.json)}`);
  }

  // Verify the update by fetching the product
  const getProductRes = await api('GET', `/products?countryId=${tzId}`, adminToken);
  if (getProductRes.status !== 200) {
    throw new Error(`Failed to fetch products: ${JSON.stringify(getProductRes.json)}`);
  }
  const products = getProductRes.json as any[];
  const updatedProduct = products.find((p: any) => p.id === productId);
  if (!updatedProduct) {
    throw new Error('Product not found after update');
  }
  console.log(`  ✅  Product updated: price=${updatedProduct.price}, distributorPrice=${updatedProduct.distributorPrice}\n`);

  // ─────────────────────────────────────────────────────────────────────────
  // TEST 3 — POST /api/customer-sales logging a sale of 2 units
  // ─────────────────────────────────────────────────────────────────────────
  console.log('3️⃣   Logging a customer sale (2 units)…');
  const saleRes = await api('POST', '/customer-sales', sellerToken!, {
    customerName: 'Test Customer',
    customerPhone: '+255712345679',
    countryId: tzId,
    items: [{ productId, quantity: 2 }],
  });
  console.log(`  Status: ${saleRes.status}`);
  if (saleRes.status !== 201) {
    throw new Error(`Failed to log customer sale: ${JSON.stringify(saleRes.json)}`);
  }
  const sale = saleRes.json;
  console.log(`  ✅  Customer sale created: ${sale.id}`);
  console.log(`  ✅  totalAmount: ${sale.totalAmount} (expected 200,000)`);
  console.log(`  ✅  totalPV: ${sale.totalPV} (expected ${2 * productPV})`);
  
  const expectedAmount = 2 * 100000;
  const expectedPV = 2 * productPV;
  if (sale.totalAmount !== expectedAmount) {
    throw new Error(`Expected totalAmount=${expectedAmount}, got ${sale.totalAmount}`);
  }
  if (sale.totalPV !== expectedPV) {
    throw new Error(`Expected totalPV=${expectedPV}, got ${sale.totalPV}`);
  }
  console.log('  ✅  Totals are correct!\n');

  // ─────────────────────────────────────────────────────────────────────────
  // TEST 4 — Verify commissions row created with retail_profit and correct amount
  // ─────────────────────────────────────────────────────────────────────────
  console.log('4️⃣   Verifying retail_profit commission entry…');
  const { data: commissions } = await supabase
    .from('commissions')
    .select('*')
    .eq('beneficiary_id', sellerId)
    .eq('type', 'retail_profit')
    .eq('source_id', sale.id)
    .eq('source_type', 'customer_sale')
    .maybeSingle();

  if (!commissions) {
    throw new Error('No retail_profit commission entry found!');
  }
  console.log(`  ✅  Commission entry found: ${commissions.id}`);
  console.log(`  ✅  type: ${commissions.type} (expected retail_profit)`);
  console.log(`  ✅  amount: ${Number(commissions.amount)} (expected 40,000)`);
  
  const expectedProfit = 2 * (100000 - 80000); // 2 units × 20,000 margin
  if (Number(commissions.amount) !== expectedProfit) {
    throw new Error(`Expected commission amount=${expectedProfit}, got ${Number(commissions.amount)}`);
  }
  console.log('  ✅  Retail profit amount is correct!\n');

  // ─────────────────────────────────────────────────────────────────────────
  // TEST 5 — GET /api/customer-sales to confirm the logged sale appears
  // ─────────────────────────────────────────────────────────────────────────
  console.log('5️⃣   Fetching customer sales history…');
  const listRes = await api('GET', '/customer-sales', sellerToken!);
  console.log(`  Status: ${listRes.status}`);
  if (listRes.status !== 200) {
    throw new Error(`Failed to fetch customer sales: ${JSON.stringify(listRes.json)}`);
  }
  const salesList = listRes.json;
  console.log(`  ✅  Found ${salesList.total} sales`);
  const foundSale = salesList.sales.find((s: any) => s.id === sale.id);
  if (!foundSale) {
    throw new Error('Logged sale not found in history!');
  }
  console.log(`  ✅  Sale ${sale.id} appears in history\n`);

  // ─────────────────────────────────────────────────────────────────────────
  // TEST 6 — GET /api/ranks/me to verify personalPV includes both sources
  // ─────────────────────────────────────────────────────────────────────────
  console.log('6️⃣   Verifying personalPV includes both order and customer sale PV…');
  const ranksRes = await api('GET', '/ranks/me', sellerToken!);
  console.log(`  Status: ${ranksRes.status}`);
  if (ranksRes.status !== 200) {
    throw new Error(`Failed to fetch rank progress: ${JSON.stringify(ranksRes.json)}`);
  }
  const rankData = ranksRes.json;
  console.log(`  ✅  personalPV: ${rankData.personalPV}`);
  console.log(`  ✅  This should include PV from both orders and customer sales`);
  
  // Verify the customer sale PV is included
  if (rankData.personalPV < expectedPV) {
    throw new Error(`personalPV (${rankData.personalPV}) should be at least ${expectedPV} from the customer sale`);
  }
  console.log('  ✅  Personal PV correctly includes customer sale PV!\n');

  console.log('─────────────────────────────────────────────────────────────');
  console.log('🎉  ALL STEP 13 VERIFICATION TESTS PASSED!');
  console.log('─────────────────────────────────────────────────────────────\n');
}

run().catch((err) => {
  console.error('\n❌  Test failed:', err.message ?? err);
  process.exit(1);
});
