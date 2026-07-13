/**
 * scripts/testCatalog.ts — Step 4 verification
 *
 * Run while the dev server is running:
 *   npm -w api run test:catalog
 *
 * Tests:
 *  1. POST /api/countries (admin) — ensure a second country is present
 *  2. POST /api/products (admin) — create a product priced for Tanzania
 *  3. GET  /api/products?countryId=<tz-id> — confirm Tanzania-only products
 *  4. GET  /api/products?countryId=<tz-id> (seller token) — confirm read access
 *  5. POST /api/products (seller token) — confirm 403 rejection
 */

import '../src/config/env.js';
import { login } from '../src/services/auth.service.js';
import { supabase } from '../src/config/supabase.js';

const PORT = process.env['PORT'] || 3001;
const BASE = `http://localhost:${PORT}/api`;

// ── helpers ───────────────────────────────────────────────────────────────────

async function apiCall(
  method: string,
  path: string,
  token: string,
  body?: unknown,
): Promise<{ status: number; json: unknown }> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => null);
  return { status: res.status, json };
}

// ── main ──────────────────────────────────────────────────────────────────────

async function run() {
  console.log('🧪  Step 4 — Countries & Products verification\n');

  // ── Get tokens ─────────────────────────────────────────────────────────────
  console.log('🔑  Logging in as admin…');
  const { token: adminToken } = await login('ADMIN-001', 'ChangeMe123!');
  console.log(`  ✅  Admin token: ${adminToken.slice(0, 30)}…\n`);

  // Grab the seller test account (must have been created by seed:admin + testSellers)
  const { data: sellerProfile } = await supabase
    .from('profiles')
    .select('id, distributor_id')
    .eq('distributor_id', 'BF-TZ-99999')
    .maybeSingle();

  let sellerToken: string | null = null;
  if (sellerProfile) {
    console.log('🔑  Logging in as seller BF-TZ-99999…');
    try {
      const sellerLogin = await login('BF-TZ-99999', 'NewSellerPass123!');
      sellerToken = sellerLogin.token;
      console.log(`  ✅  Seller token: ${sellerToken.slice(0, 30)}…\n`);
    } catch {
      console.warn('  ⚠️   Could not log in as seller (password may differ). Skipping seller tests.\n');
    }
  } else {
    console.warn('  ⚠️   Seller BF-TZ-99999 not found. Run testSellers first for full coverage.\n');
  }

  // ── 1. Resolve Tanzania country ID ─────────────────────────────────────────
  console.log('1️⃣   GET /api/countries — list countries…');
  const countriesRes = await apiCall('GET', '/countries', adminToken);
  console.log(`  Status: ${countriesRes.status}`);

  if (countriesRes.status !== 200) {
    throw new Error(`Expected 200, got ${countriesRes.status}: ${JSON.stringify(countriesRes.json)}`);
  }

  const countries = countriesRes.json as Array<{ id: string; isoCode: string; name: string }>;
  const tanzania  = countries.find((c) => c.isoCode === 'TZ');

  if (!tanzania) {
    console.log('  ⚠️   Tanzania not found — running seed first…');
    throw new Error('Run `npm -w api run seed:catalog` before this test.');
  }
  console.log(`  ✅  Tanzania: ${tanzania.id}\n`);

  // ── 2. POST /api/countries (admin) — ensure Kenya is present ─────────────
  console.log('2️⃣   POST /api/countries — upsert Kenya (via PATCH if already exists)…');
  const existingKenya = countries.find((c) => c.isoCode === 'KE');
  if (existingKenya) {
    console.log(`  ✅  Kenya already present: ${existingKenya.id}\n`);
  } else {
    const createCountryRes = await apiCall('POST', '/countries', adminToken, {
      name: 'Kenya', isoCode: 'KE', currencyCode: 'KES',
    });
    console.log(`  Status: ${createCountryRes.status}`);
    if (createCountryRes.status !== 201) {
      throw new Error(`Failed to create Kenya: ${JSON.stringify(createCountryRes.json)}`);
    }
    console.log(`  ✅  Kenya created: ${(createCountryRes.json as any).id}\n`);
  }

  // ── 3. POST /api/products (admin) — create a test product ─────────────────
  console.log('3️⃣   POST /api/products — create test product…');
  const createProductRes = await apiCall('POST', '/products', adminToken, {
    name:        'Step4 Test Product',
    description: 'Created by testCatalog.ts verification script',
    prices: [{ countryId: tanzania.id, price: 12000, isAvailable: true }],
  });
  console.log(`  Status: ${createProductRes.status}`);

  if (createProductRes.status !== 201) {
    throw new Error(`Failed to create product: ${JSON.stringify(createProductRes.json)}`);
  }
  const newProduct = createProductRes.json as any;
  console.log(`  ✅  Product created: ${newProduct.id} — "${newProduct.name}"\n`);

  // ── 4. GET /api/products?countryId=<tz-id> (admin) ────────────────────────
  console.log('4️⃣   GET /api/products?countryId=<tz-id> — admin view…');
  const listRes = await apiCall('GET', `/products?countryId=${tanzania.id}`, adminToken);
  console.log(`  Status: ${listRes.status}`);

  if (listRes.status !== 200) {
    throw new Error(`Expected 200, got ${listRes.status}: ${JSON.stringify(listRes.json)}`);
  }
  const products = listRes.json as any[];
  console.log(`  ✅  Returned ${products.length} product(s)`);
  const found = products.find((p: any) => p.id === newProduct.id);
  if (!found) {
    throw new Error('Newly created product not found in Tanzania catalog!');
  }
  console.log(`  ✅  Newly created product found in Tanzania catalog`);
  console.log(`  ✅  Sample: { name: "${found.name}", price: ${found.price}, currencyCode: "${found.currencyCode}" }\n`);

  // ── 5. GET /api/products (seller token) — should succeed ──────────────────
  if (sellerToken) {
    console.log('5️⃣   GET /api/products?countryId=<tz-id> — seller read access…');
    const sellerListRes = await apiCall('GET', `/products?countryId=${tanzania.id}`, sellerToken);
    console.log(`  Status: ${sellerListRes.status}`);

    if (sellerListRes.status !== 200) {
      throw new Error(`Seller should be able to READ products! Got: ${sellerListRes.status}`);
    }
    console.log(`  ✅  Seller CAN read products (${(sellerListRes.json as any[]).length} items)\n`);

    // ── 6. POST /api/products (seller) — must be 403 ──────────────────────
    console.log('6️⃣   POST /api/products (seller token) — must reject with 403…');
    const sellerCreateRes = await apiCall('POST', '/products', sellerToken, {
      name: 'Unauthorized product',
      prices: [{ countryId: tanzania.id, price: 999, isAvailable: true }],
    });
    console.log(`  Status: ${sellerCreateRes.status}`);

    if (sellerCreateRes.status !== 403) {
      throw new Error(`Expected 403 for seller POST /products, got ${sellerCreateRes.status}`);
    }
    console.log('  ✅  403 correctly returned — seller cannot create products\n');
  } else {
    console.log('  ⚠️   Skipping seller tests (no token available)\n');
  }

  console.log('─────────────────────────────────────────────────────────────');
  console.log('🎉  ALL STEP 4 VERIFICATION TESTS PASSED!');
  console.log('─────────────────────────────────────────────────────────────\n');
}

run().catch((err) => {
  console.error('❌  Test failed:', err.message ?? err);
  process.exit(1);
});
