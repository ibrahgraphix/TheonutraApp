/**
 * scripts/seedCatalog.ts
 *
 * Seeds reference data needed for Step 4 testing:
 *  - Upserts Tanzania and Kenya in `countries`
 *  - Inserts 5 sample products (if not already present)
 *  - Prices each product in Tanzania (and some in Kenya)
 *
 * Run from the monorepo root:
 *   npm -w api run seed:catalog
 *
 * Or directly:
 *   tsx apps/api/scripts/seedCatalog.ts
 */

// Load env first, before any other import touches process.env
import '../src/config/env.js';

import { supabase } from '../src/config/supabase.js';

// ── Sample data ────────────────────────────────────────────────────────────────

const COUNTRIES = [
  { name: 'Tanzania', iso_code: 'TZ', currency_code: 'TZS' },
  { name: 'Kenya',    iso_code: 'KE', currency_code: 'KES' },
] as const;

const PRODUCTS = [
  {
    name:        'Theonutra Gold Capsules',
    description: 'Premium theobroma-based wellness supplement, 60 caps.',
    image_url:   null,
    pv:          10,
  },
  {
    name:        'Theonutra Slim Shake',
    description: 'Meal-replacement shake with natural cocoa extract, chocolate flavour.',
    image_url:   null,
    pv:          8,
  },
  {
    name:        'Theonutra Immune Booster',
    description: 'High-potency vitamin-C blend with theobroma for daily immunity support.',
    image_url:   null,
    pv:          9,
  },
  {
    name:        'Theonutra Energy Bar',
    description: 'No-added-sugar energy bar with cacao nibs and oats.',
    image_url:   null,
    pv:          3,
  },
  {
    name:        'Theonutra Herbal Tea',
    description: 'Relaxing blend of theobroma leaf, chamomile, and lemongrass, 20 bags.',
    image_url:   null,
    pv:          4,
  },
] as const;

/** Extra catalog names used in manual / test_plan flows — ensure non-zero PV when present. */
const EXTRA_PRODUCT_PV: Record<string, number> = {
  'Omega 3 Capsules': 10,
  'Omega3 capsule': 10,
  'Omega3 Capsule': 10,
  'Slimfit tea': 5,
  'Slimfit Tea': 5,
  'Headache Pills': 2,
  'Retail Profit Test Product': 50,
};

// Price per product per country (in local currency)
// Structure: [productIndex, isoCode, price]
const PRICES: [number, string, number][] = [
  [0, 'TZ', 55_000],
  [0, 'KE',  3_200],
  [1, 'TZ', 45_000],
  [1, 'KE',  2_600],
  [2, 'TZ', 48_000],
  [2, 'KE',  2_800],
  [3, 'TZ', 18_000],
  [3, 'KE',  1_050],
  [4, 'TZ', 22_000],
  [4, 'KE',  1_300],
];

/** Wholesale ≈ 80% of customer/retail price when distributor_price is missing. */
function wholesaleFromRetail(price: number): number {
  return Math.round(price * 0.8);
}

// ── Seed function ──────────────────────────────────────────────────────────────

async function seedCatalog() {
  console.log('🌱  Seeding catalog (countries + products)…\n');

  // ── Step 1: Upsert countries ───────────────────────────────────────────────
  console.log('  [1/3] Upserting countries…');
  const countryIdByIso: Record<string, string> = {};

  for (const c of COUNTRIES) {
    const { data, error } = await supabase
      .from('countries')
      .upsert(
        { name: c.name, iso_code: c.iso_code, currency_code: c.currency_code, is_active: true },
        { onConflict: 'iso_code', ignoreDuplicates: false },
      )
      .select('id, iso_code')
      .single();

    if (error || !data) {
      console.error(`  ❌  Failed to upsert ${c.name}:`, error?.message);
      process.exit(1);
    }

    countryIdByIso[data.iso_code] = data.id;
    console.log(`  ✅  ${c.name} (${data.iso_code}) → ${data.id}`);
  }

  console.log();

  // ── Step 2: Get or create the admin profile (needed for created_by) ────────
  console.log('  [2/3] Resolving admin profile ID…');
  const { data: adminProfile, error: adminErr } = await supabase
    .from('profiles')
    .select('id')
    .eq('distributor_id', 'ADMIN-001')
    .maybeSingle();

  if (adminErr) {
    console.error('  ❌  Failed to fetch admin profile:', adminErr.message);
    process.exit(1);
  }

  const adminId = adminProfile?.id ?? null;
  console.log(adminId ? `  ✅  Admin ID: ${adminId}` : '  ⚠️   No admin profile found; created_by will be null');
  console.log();

  // ── Step 3: Upsert products + prices ──────────────────────────────────────
  console.log('  [3/3] Upserting products and prices…');

  for (let i = 0; i < PRODUCTS.length; i++) {
    const p = PRODUCTS[i];

    // Check if a product with this name already exists (no UNIQUE constraint, so we query first)
    const { data: existing } = await supabase
      .from('products')
      .select('id, name')
      .eq('name', p.name)
      .eq('is_active', true)
      .maybeSingle();

    let product: { id: string; name: string };

    if (existing) {
      product = existing;
      // Keep catalog PV in sync for V1 compensation (PPV = qty × product.pv)
      const { error: pvErr } = await supabase
        .from('products')
        .update({ pv: p.pv })
        .eq('id', existing.id);
      if (pvErr) {
        console.error(`  ❌  Failed to update PV for "${p.name}":`, pvErr.message);
        process.exit(1);
      }
    } else {
      // Insert new product
      const { data: inserted, error: productErr } = await supabase
        .from('products')
        .insert({
          name:        p.name,
          description: p.description,
          image_url:   p.image_url,
          is_active:   true,
          created_by:  adminId,
          pv:          p.pv,
        })
        .select('id, name')
        .single();

      if (productErr || !inserted) {
        console.error(`  ❌  Failed to insert product "${p.name}":`, productErr?.message);
        process.exit(1);
      }
      product = inserted;
    }

    // Gather price rows for this product (retail + wholesale)
    const priceRows = PRICES
      .filter(([idx]) => idx === i)
      .map(([, iso, price]) => ({
        product_id:         product.id,
        country_id:         countryIdByIso[iso],
        price,
        distributor_price:  wholesaleFromRetail(price),
        is_available:       true,
      }))
      .filter((r) => r.country_id); // skip if country wasn't seeded

    if (priceRows.length > 0) {
      const { error: priceErr } = await supabase
        .from('product_prices')
        .upsert(priceRows, { onConflict: 'product_id,country_id' });

      if (priceErr) {
        console.error(`  ❌  Failed to upsert prices for "${p.name}":`, priceErr.message);
        process.exit(1);
      }
    }

    const priceStr = priceRows
      .map((r) => {
        const iso = Object.entries(countryIdByIso).find(([, id]) => id === r.country_id)?.[0];
        return `${iso}: ${r.price.toLocaleString()} (WS ${r.distributor_price.toLocaleString()})`;
      })
      .join(', ');
    const status = existing ? '(already existed)' : '(newly inserted)';
    console.log(`  ✅  "${product.name}" ${status} — PV ${p.pv} — prices: ${priceStr}`);
  }

  // Ensure common manual/test products have non-zero PV when they already exist
  console.log('\n  [3b] Ensuring extra product PV…');
  for (const [name, pv] of Object.entries(EXTRA_PRODUCT_PV)) {
    const { data: extra } = await supabase
      .from('products')
      .select('id, pv')
      .ilike('name', name)
      .eq('is_active', true)
      .maybeSingle();
    if (!extra) continue;
    if (Number(extra.pv ?? 0) > 0 && Number(extra.pv) === pv) {
      console.log(`  ✅  "${name}" already has PV ${pv}`);
      continue;
    }
    const { error: extraErr } = await supabase
      .from('products')
      .update({ pv })
      .eq('id', extra.id);
    if (extraErr) {
      console.error(`  ❌  Failed to set PV for "${name}":`, extraErr.message);
    } else {
      console.log(`  ✅  "${name}" PV → ${pv}`);
    }
  }

  // Backfill placement_sponsor_id from referred_by where missing (legs UI)
  console.log('\n  [3c] Backfilling placement_sponsor_id…');
  const { data: missingPlacement, error: missingErr } = await supabase
    .from('profiles')
    .select('id, referred_by')
    .is('placement_sponsor_id', null)
    .not('referred_by', 'is', null)
    .eq('role', 'distributor');
  if (missingErr) {
    console.error('  ⚠️   Could not scan placement gaps:', missingErr.message);
  } else {
    let fixed = 0;
    for (const row of missingPlacement ?? []) {
      const { error: fixErr } = await supabase
        .from('profiles')
        .update({ placement_sponsor_id: row.referred_by })
        .eq('id', row.id)
        .is('placement_sponsor_id', null);
      if (!fixErr) fixed += 1;
    }
    console.log(`  ✅  Backfilled placement_sponsor_id on ${fixed} profile(s)`);
  }

  console.log('\n─────────────────────────────────────────────────────────────');
  console.log('🎉  Catalog seeded successfully!');
  console.log('\n  Tanzania country ID:', countryIdByIso['TZ']);
  console.log('  Kenya country ID:   ', countryIdByIso['KE']);
  console.log('─────────────────────────────────────────────────────────────\n');
}

seedCatalog().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
