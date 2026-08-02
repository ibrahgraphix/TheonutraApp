/**
 * Smoke test: V1 monthly job + network bonus creation (Checkout Step 4).
 * Requires API running. Creates a temporary sponsor/downline with PV via customer sale,
 * runs monthly job, asserts network_bonuses rows, then cleans nothing (safe leftovers).
 *
 * Run: npm -w api exec -- tsx scripts/smokeV1Monthly.ts
 */
import '../src/config/env.js';
import { login } from '../src/services/auth.service.js';
import { supabase } from '../src/config/supabase.js';

const PORT = process.env['PORT'] || 3001;
const BASE = `http://localhost:${PORT}/api`;

async function api(method: string, path: string, token: string, body?: unknown) {
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
  console.log('🧪  V1 Monthly Job smoke\n');
  const { token: adminToken } = await login('ADMIN-001', 'ChangeMe123!');

  const { data: tz } = await supabase.from('countries').select('id').eq('iso_code', 'TZ').single();
  if (!tz) throw new Error('TZ missing');

  const stamp = Date.now().toString().slice(-6);
  const sponsorCode = `SMK-SP-${stamp}`;
  const downCode = `SMK-DN-${stamp}`;

  const sponsorRes = await api('POST', '/sellers', adminToken, {
    distributorId: sponsorCode,
    fullName: 'Smoke Sponsor',
    phoneNumber: `+255711${stamp}`,
    password: 'SmokePass123!',
    countryId: tz.id,
  });
  if (sponsorRes.status !== 201) throw new Error(JSON.stringify(sponsorRes.json));
  const sponsorId = sponsorRes.json.id as string;

  const downRes = await api('POST', '/sellers', adminToken, {
    distributorId: downCode,
    fullName: 'Smoke Downline',
    phoneNumber: `+255712${stamp}`,
    password: 'SmokePass123!',
    countryId: tz.id,
    referredBy: sponsorId,
  });
  if (downRes.status !== 201) throw new Error(JSON.stringify(downRes.json));
  const downId = downRes.json.id as string;

  const { data: placement } = await supabase
    .from('profiles')
    .select('leg_position, placement_sponsor_id, referred_by')
    .eq('id', downId)
    .single();
  console.log('  Placement:', placement);
  if (!placement?.leg_position) throw new Error('Downline missing leg_position');
  if (placement.placement_sponsor_id !== sponsorId && placement.referred_by !== sponsorId) {
    throw new Error('Downline not linked to sponsor');
  }

  const { data: product } = await supabase
    .from('products')
    .select('id, pv')
    .eq('name', 'Retail Profit Test Product')
    .maybeSingle();
  if (!product) throw new Error('Test product missing — run seed:catalog / test:customer-sales once');

  // Ensure Star ranks exist and give both enough PPV via customer sales
  const sponsorToken = (await login(sponsorCode, 'SmokePass123!')).token;
  const downToken = (await login(downCode, 'SmokePass123!')).token;

  for (const [token, label] of [
    [sponsorToken, 'sponsor'],
    [downToken, 'downline'],
  ] as const) {
    const sale = await api('POST', '/customer-sales', token, {
      customerName: `Smoke ${label}`,
      countryId: tz.id,
      items: [{ productId: product.id, quantity: 1 }],
    });
    if (sale.status !== 201) throw new Error(`${label} sale failed: ${JSON.stringify(sale.json)}`);
    console.log(`  ✅  ${label} sale PV=${sale.json.totalPV}`);
  }

  const period = new Date().toISOString().slice(0, 7);
  const job = await api('POST', '/compensation/v1/run-monthly', adminToken, { period });
  console.log('  Monthly job:', job.status, job.json);
  if (job.status !== 200) throw new Error(`Monthly job failed: ${JSON.stringify(job.json)}`);

  const { data: bonuses } = await supabase
    .from('network_bonuses')
    .select('bonus_type, bonus_pv, amount_tzs, status, distributor_id')
    .eq('period', period)
    .in('distributor_id', [sponsorId, downId]);

  console.log('  network_bonuses:', bonuses);
  const sponsorAmb = (bonuses ?? []).find(
    (b) => b.distributor_id === sponsorId && b.bonus_type === 'active_monthly',
  );
  if (!sponsorAmb) throw new Error('Expected active_monthly bonus for sponsor');
  if (sponsorAmb.status !== 'pending') throw new Error('Bonus should be pending');

  const snap = await api('GET', '/compensation/v1/me', sponsorToken);
  console.log('  Sponsor snapshot legs:', snap.json?.legs);
  if (!snap.json?.legs) throw new Error('Missing legs on snapshot');

  const legHasDown = ['left', 'center', 'right'].some(
    (leg) => snap.json.legs[leg]?.memberId === downId,
  );
  if (!legHasDown) throw new Error('Sponsor legs do not show downline member');

  console.log('\n🎉  V1 monthly smoke passed\n');
}

run().catch((e) => {
  console.error('❌', e);
  process.exit(1);
});
