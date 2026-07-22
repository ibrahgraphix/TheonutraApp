/**
 * scripts/testManualBonus.ts — Step 16 verification (Manual Bonuses)
 *
 * Prerequisites:
 *  1. Dev server running (npm -w api run dev)
 *  2. patch_manual_bonus.sql applied in Supabase SQL Editor
 *
 * Run:
 *   npm -w api run test:manual-bonus
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
  console.log('🧪  Step 16 — Manual Bonuses Verification Tests\n');

  // ── Admin login ───────────────────────────────────────────────────────────
  console.log('🔑  Logging in as admin…');
  const { token: adminToken } = await login('ADMIN-001', 'ChangeMe123!');
  console.log(`  ✅  Admin token: ${adminToken.slice(0, 30)}…`);

  // ── Country ───────────────────────────────────────────────────────────────
  const { data: tzCountry } = await supabase
    .from('countries').select('id').eq('iso_code', 'TZ').single();
  if (!tzCountry) throw new Error('Tanzania not seeded — run seed:catalog first');
  const tzId = tzCountry.id as string;
  console.log(`  ✅  Tanzania ID: ${tzId}`);

  // ── Create two test distributors ─────────────────────────────────────────
  const distAId = `MB-A-${Date.now()}`;
  const distARes = await api('POST', '/sellers', adminToken, {
    distributorId: distAId,
    fullName: 'Manual Bonus Dist A',
    phoneNumber: `+255799${Date.now().toString().slice(-6)}`,
    password: 'DistAPass123!',
    countryId: tzId,
  });
  if (distARes.status !== 201) throw new Error(`Failed to create dist A: ${JSON.stringify(distARes.json)}`);
  const distAProfile = distARes.json;
  console.log(`  ✅  Distributor A created: ${distAId} (id: ${distAProfile.id})`);

  const distBId = `MB-B-${Date.now()}`;
  const distBRes = await api('POST', '/sellers', adminToken, {
    distributorId: distBId,
    fullName: 'Manual Bonus Dist B',
    phoneNumber: `+255788${Date.now().toString().slice(-6)}`,
    password: 'DistBPass123!',
    countryId: tzId,
  });
  if (distBRes.status !== 201) throw new Error(`Failed to create dist B: ${JSON.stringify(distBRes.json)}`);
  const distBProfile = distBRes.json;
  console.log(`  ✅  Distributor B created: ${distBId} (id: ${distBProfile.id})`);

  const distAToken = (await login(distAId, 'DistAPass123!')).token;

  // ────────────────────────────────────────────────────────────────────────
  // TEST 1: Non-staff cannot award a bonus (403)
  // ────────────────────────────────────────────────────────────────────────
  console.log('\n1️⃣  Non-staff cannot award a bonus...');
  const unauthorisedRes = await api('POST', '/manual-bonuses', distAToken, {
    distributorId: distAProfile.id,
    bonusCategory: 'leadership',
    amount: 500,
    note: 'Should be blocked',
  });
  console.log(`  ✅ Non-staff award attempt status: ${unauthorisedRes.status} (expected 403)`);
  if (unauthorisedRes.status !== 403) throw new Error(`Expected 403, got ${unauthorisedRes.status}`);

  // ────────────────────────────────────────────────────────────────────────
  // TEST 2: Award bonus creates record, credits wallet, logs ledger entry
  // ────────────────────────────────────────────────────────────────────────
  console.log('\n2️⃣  Awarding leadership bonus to Dist A...');
  const bonusAmount = 5000;
  const awardRes = await api('POST', '/manual-bonuses', adminToken, {
    distributorId: distAProfile.id,
    bonusCategory: 'leadership',
    amount: bonusAmount,
    note: 'Leadership excellence Q3',
  });
  if (awardRes.status !== 201) throw new Error(`Failed to award bonus: ${JSON.stringify(awardRes.json)}`);
  const bonus = awardRes.json;
  console.log(`  ✅ Bonus awarded. ID: ${bonus.id}`);
  console.log(`  ✅ bonus_category: ${bonus.bonus_category} (expected: leadership)`);
  console.log(`  ✅ amount: ${bonus.amount} (expected: ${bonusAmount})`);
  if (bonus.bonus_category !== 'leadership' || Number(bonus.amount) !== bonusAmount) {
    throw new Error('Bonus record mismatch');
  }

  // Verify wallet is credited
  const walletRes = await api('GET', '/wallet/me', distAToken);
  if (walletRes.status !== 200) throw new Error(`Failed to get wallet: ${JSON.stringify(walletRes.json)}`);
  const walletBalance = Number(walletRes.json.balance);
  console.log(`  ✅ Wallet balance after bonus: ${walletBalance} (expected: ${bonusAmount})`);
  if (Math.abs(walletBalance - bonusAmount) > 0.01) {
    throw new Error(`Expected wallet balance ${bonusAmount}, got ${walletBalance}`);
  }

  // Verify ledger transaction
  const txRes = walletRes.json.recentTransactions;
  console.log(`  ✅ Ledger transaction count: ${txRes.length} (expected 1)`);
  if (txRes.length !== 1) throw new Error(`Expected 1 tx, got ${txRes.length}`);
  const tx = txRes[0];
  console.log(`  ✅ Ledger tx: type=${tx.type}, source_type=${tx.source_type}, amount=${tx.amount}, balance_after=${tx.balance_after}`);
  if (tx.type !== 'credit' || tx.source_type !== 'manual_bonus' || Math.abs(Number(tx.amount) - bonusAmount) > 0.01) {
    throw new Error(`Ledger tx details mismatch: type=${tx.type} source_type=${tx.source_type} amount=${tx.amount}`);
  }
  if (Math.abs(Number(tx.balance_after) - walletBalance) > 0.01) {
    throw new Error(`Ledger balance_after mismatch: ${tx.balance_after} vs wallet ${walletBalance}`);
  }
  console.log('  ✅ Wallet auto-credited and ledger entry verified!');

  // ────────────────────────────────────────────────────────────────────────
  // TEST 3: Award a second bonus of different category to verify filtering
  // ────────────────────────────────────────────────────────────────────────
  console.log('\n3️⃣  Awarding rank_achievement bonus to Dist B...');
  const bonusBAmount = 2500;
  const awardBRes = await api('POST', '/manual-bonuses', adminToken, {
    distributorId: distBProfile.id,
    bonusCategory: 'rank_achievement',
    amount: bonusBAmount,
    note: 'Reached Gold rank',
  });
  if (awardBRes.status !== 201) throw new Error(`Failed to award bonus B: ${JSON.stringify(awardBRes.json)}`);
  console.log(`  ✅ Bonus awarded to Dist B. ID: ${awardBRes.json.id}`);

  // ────────────────────────────────────────────────────────────────────────
  // TEST 4: Distributor can only see their own bonuses via /mine
  // ────────────────────────────────────────────────────────────────────────
  console.log('\n4️⃣  Testing /mine scoping...');
  const mineRes = await api('GET', '/manual-bonuses/mine', distAToken);
  if (mineRes.status !== 200) throw new Error(`Failed to get /mine: ${JSON.stringify(mineRes.json)}`);
  const myBonuses = mineRes.json.bonuses;
  console.log(`  ✅ Dist A /mine count: ${myBonuses.length} (expected 1)`);
  if (myBonuses.length !== 1) throw new Error(`Expected 1 bonus in /mine, got ${myBonuses.length}`);
  const myBonus = myBonuses[0];
  if (myBonus.distributor_id !== distAProfile.id) {
    throw new Error('Dist A can see another distributor\'s bonus!');
  }
  console.log(`  ✅ Dist A can only see their own bonuses (distributor_id matches)`);

  // ────────────────────────────────────────────────────────────────────────
  // TEST 5: Staff can list all bonuses and filter by category
  // ────────────────────────────────────────────────────────────────────────
  console.log('\n5️⃣  Testing staff list all with category filter...');
  const allRes = await api('GET', '/manual-bonuses', adminToken);
  if (allRes.status !== 200) throw new Error(`Failed to list all: ${JSON.stringify(allRes.json)}`);
  console.log(`  ✅ Staff /manual-bonuses total: ${allRes.json.total} (at least 2 expected)`);
  if (allRes.json.total < 2) throw new Error(`Expected at least 2 total bonuses, got ${allRes.json.total}`);

  // Filter by category leadership
  const leadershipRes = await api('GET', '/manual-bonuses?category=leadership', adminToken);
  if (leadershipRes.status !== 200) throw new Error(`Failed to filter by category: ${JSON.stringify(leadershipRes.json)}`);
  console.log(`  ✅ leadership category count: ${leadershipRes.json.total} (at least 1)`);
  if (leadershipRes.json.total < 1) throw new Error(`Expected at least 1 leadership bonus, got ${leadershipRes.json.total}`);
  const allLeadership = leadershipRes.json.bonuses.every((b: any) => b.bonus_category === 'leadership');
  if (!allLeadership) throw new Error('Filter returned non-leadership bonuses!');
  console.log(`  ✅ All returned records have bonus_category=leadership`);

  // Filter by distributor
  const distAFilterRes = await api('GET', `/manual-bonuses?distributorId=${distAProfile.id}`, adminToken);
  if (distAFilterRes.status !== 200) throw new Error(`Failed to filter by distributor: ${JSON.stringify(distAFilterRes.json)}`);
  console.log(`  ✅ Dist A filtered count: ${distAFilterRes.json.total} (expected 1)`);
  if (distAFilterRes.json.total !== 1) throw new Error(`Expected 1 bonus for dist A, got ${distAFilterRes.json.total}`);

  // ────────────────────────────────────────────────────────────────────────
  // TEST 6: Ledger reconciliation still holds after manual bonuses
  // ────────────────────────────────────────────────────────────────────────
  console.log('\n6️⃣  Checking ledger reconciliation for Dist A...');
  const txHistoryRes = await api('GET', '/wallet/transactions', distAToken);
  if (txHistoryRes.status !== 200) throw new Error(`Failed to get tx history: ${JSON.stringify(txHistoryRes.json)}`);
  const allTxs = txHistoryRes.json.transactions;
  const ledgerSum = allTxs.reduce((sum: number, tx: any) => {
    const val = Number(tx.amount);
    return sum + (tx.type === 'credit' ? val : -val);
  }, 0);

  const currentBalance = Number((await api('GET', '/wallet/me', distAToken)).json.balance);
  console.log(`  ✅ Sum of ledger transactions: ${ledgerSum}`);
  console.log(`  ✅ Current wallet balance: ${currentBalance}`);
  if (Math.abs(ledgerSum - currentBalance) > 0.01) {
    throw new Error(`Ledger does not reconcile! Sum=${ledgerSum}, Balance=${currentBalance}`);
  }
  console.log('  ✅ Ledger reconciles perfectly!');

  console.log('\n─────────────────────────────────────────────────────────────');
  console.log('🎉  ALL STEP 16 VERIFICATION TESTS PASSED!');
  console.log('─────────────────────────────────────────────────────────────\n');
}

run().catch((err) => {
  console.error('\n❌  Test failed:', err.message ?? err);
  process.exit(1);
});
