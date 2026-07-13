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
  },
  {
    name:        'Theonutra Slim Shake',
    description: 'Meal-replacement shake with natural cocoa extract, chocolate flavour.',
    image_url:   null,
  },
  {
    name:        'Theonutra Immune Booster',
    description: 'High-potency vitamin-C blend with theobroma for daily immunity support.',
    image_url:   null,
  },
  {
    name:        'Theonutra Energy Bar',
    description: 'No-added-sugar energy bar with cacao nibs and oats.',
    image_url:   null,
  },
  {
    name:        'Theonutra Herbal Tea',
    description: 'Relaxing blend of theobroma leaf, chamomile, and lemongrass, 20 bags.',
    image_url:   null,
  },
] as const;

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
        })
        .select('id, name')
        .single();

      if (productErr || !inserted) {
        console.error(`  ❌  Failed to insert product "${p.name}":`, productErr?.message);
        process.exit(1);
      }
      product = inserted;
    }

    // Gather price rows for this product
    const priceRows = PRICES
      .filter(([idx]) => idx === i)
      .map(([, iso, price]) => ({
        product_id:   product.id,
        country_id:   countryIdByIso[iso],
        price,
        is_available: true,
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
        return `${iso}: ${r.price.toLocaleString()}`;
      })
      .join(', ');
    const status = existing ? '(already existed)' : '(newly inserted)';
    console.log(`  ✅  "${product.name}" ${status} — prices: ${priceStr}`);
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
