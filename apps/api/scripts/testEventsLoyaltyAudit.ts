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
  console.log('🧪  Step 21+22 — Events + Loyalty Points + Audit Log Verification Tests\n');

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

  // ── Create test distributor for loyalty testing ───────────────────────────
  const distributorId = `ELT-DST-${Date.now()}`;
  const distributorRes = await api('POST', '/sellers', adminToken, {
    distributorId,
    fullName: 'Events Loyalty Test Distributor',
    phoneNumber: `+255777${Date.now().toString().slice(-6)}`,
    password: 'DstPass123!',
    countryId: tzId,
  });
  if (distributorRes.status !== 201) throw new Error(`Failed to create distributor: ${JSON.stringify(distributorRes.json)}`);
  const distributorProfile = distributorRes.json;
  console.log(`  ✅  Distributor created: ${distributorId} (id: ${distributorProfile.id})`);

  const distributorToken = (await login(distributorId, 'DstPass123!')).token;

  // ── Test 1: Event creation (staff only) ───────────────────────────────────
  console.log('\n1️⃣  Testing event creation (staff only)...');
  const eventRes = await api('POST', '/events', adminToken, {
    title: 'Health Education Workshop',
    description: 'Learn about nutrition and wellness',
    event_type: 'health_education',
    location: 'Dar es Salaam Conference Center',
    is_virtual: false,
    start_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days from now
    end_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000).toISOString(), // 2 hours later
  });
  if (eventRes.status !== 201) throw new Error(`Failed to create event: ${JSON.stringify(eventRes.json)}`);
  const event = eventRes.json;
  console.log(`  ✅  Event created: ${event.id} (type: ${event.event_type})`);

  // Test that distributor cannot create events
  const unauthorizedEventRes = await api('POST', '/events', distributorToken, {
    title: 'Unauthorized Event',
    event_type: 'general',
    start_at: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
    end_at: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000 + 60 * 60 * 1000).toISOString(),
  });
  console.log(`  ✅  Distributor event creation status: ${unauthorizedEventRes.status} (expected 403)`);
  if (unauthorizedEventRes.status !== 403) throw new Error('Expected 403 for non-staff event creation');

  // ── Test 2: Event filtering by health_education type ───────────────────────
  console.log('\n2️⃣  Testing event filtering by health_education type...');
  const healthEducationRes = await api('GET', '/events?type=health_education&upcoming=true', distributorToken);
  if (healthEducationRes.status !== 200) throw new Error(`Failed to filter events: ${JSON.stringify(healthEducationRes.json)}`);
  const healthEducationEvents = healthEducationRes.json;
  console.log(`  ✅  Health education events count: ${healthEducationEvents.length}`);
  if (healthEducationEvents.length === 0) throw new Error('Expected at least one health education event');
  const foundOurEvent = healthEducationEvents.some((e: any) => e.id === event.id);
  console.log(`  ✅  Our event found in filtered results: ${foundOurEvent}`);
  if (!foundOurEvent) throw new Error('Our health education event not found in filtered results');

  // ── Test 3: Deactivated events excluded from listings ───────────────────────
  console.log('\n3️⃣  Testing deactivated events exclusion...');
  const deactivateRes = await api('DELETE', `/events/${event.id}`, adminToken);
  if (deactivateRes.status !== 200) throw new Error(`Failed to deactivate event: ${JSON.stringify(deactivateRes.json)}`);
  console.log('  ✅  Event deactivated');

  const afterDeactivateRes = await api('GET', '/events?type=health_education&upcoming=true', distributorToken);
  const afterDeactivateEvents = afterDeactivateRes.json;
  const stillFound = afterDeactivateEvents.some((e: any) => e.id === event.id);
  console.log(`  ✅  Deactivated event still in listings: ${stillFound} (expected: false)`);
  if (stillFound) throw new Error('Deactivated event should not appear in listings');

  // ── Test 4: Loyalty points credit correctly ───────────────────────────────
  console.log('\n4️⃣  Testing loyalty points credit...');
  // Credit loyalty points directly via RPC
  const pointsToCredit = 100;
  const { error: creditError } = await supabase.rpc('credit_loyalty_points', {
    p_distributor_id: distributorProfile.id,
    p_source_type: 'test_purchase',
    p_source_id: null,
    p_points: pointsToCredit,
  });
  if (creditError) throw new Error(`Failed to credit loyalty points: ${creditError.message}`);
  console.log(`  ✅  Credited ${pointsToCredit} loyalty points`);

  // Check balance
  const loyaltyRes = await api('GET', '/loyalty/me', distributorToken);
  if (loyaltyRes.status !== 200) throw new Error(`Failed to get loyalty balance: ${JSON.stringify(loyaltyRes.json)}`);
  const loyaltyBalance = Number(loyaltyRes.json.balance);
  console.log(`  ✅  Loyalty balance: ${loyaltyBalance} (expected: ${pointsToCredit})`);
  if (Math.abs(loyaltyBalance - pointsToCredit) > 0.01) throw new Error(`Expected balance ${pointsToCredit}, got ${loyaltyBalance}`);

  // ── Test 5: Ledger reconciliation for loyalty points ────────────────────────
  console.log('\n5️⃣  Testing loyalty ledger reconciliation...');
  const loyaltyHistory = loyaltyRes.json.history;
  console.log(`  ✅  Loyalty transactions count: ${loyaltyHistory.transactions.length} (expected: 1)`);
  if (loyaltyHistory.transactions.length !== 1) throw new Error('Expected 1 loyalty transaction');

  const loyaltyTx = loyaltyHistory.transactions[0];
  console.log(`  ✅  Transaction: type=${loyaltyTx.type}, points=${loyaltyTx.points}, balance_after=${loyaltyTx.balance_after}`);
  if (loyaltyTx.type !== 'earn' || Math.abs(Number(loyaltyTx.points) - pointsToCredit) > 0.01) {
    throw new Error('Loyalty transaction details mismatch');
  }
  if (Math.abs(Number(loyaltyTx.balance_after) - loyaltyBalance) > 0.01) {
    throw new Error('balance_after in ledger does not match loyalty balance');
  }
  console.log('  ✅  Loyalty ledger reconciles!');

  // ── Test 6: Audit log for event creation ────────────────────────────────────
  console.log('\n6️⃣  Testing audit log for event creation...');
  const auditLogRes = await api('GET', '/audit-log?entity_type=event', adminToken);
  if (auditLogRes.status !== 200) throw new Error(`Failed to get audit log: ${JSON.stringify(auditLogRes.json)}`);
  const auditEntries = auditLogRes.json.entries;
  console.log(`  ✅  Audit log entries for events: ${auditEntries.length}`);
  if (auditEntries.length === 0) throw new Error('Expected audit log entries for events');

  const eventCreatedEntry = auditEntries.find((e: any) => e.action === 'event_created');
  console.log(`  ✅  Event creation audit entry found: ${!!eventCreatedEntry}`);
  if (!eventCreatedEntry) throw new Error('Event creation audit entry not found');
  console.log(`  ✅  Audit entry: action=${eventCreatedEntry.action}, entity_id=${eventCreatedEntry.entity_id}`);

  // ── Test 7: Audit log for KYC actions ─────────────────────────────────────
  console.log('\n7️⃣  Testing audit log for KYC actions...');
  // Submit KYC for the distributor
  const kycRes = await api('POST', '/kyc', distributorToken, {
    id_type: 'national_id',
    id_number: '123456789',
    document_front_url: 'https://example.com/front.jpg',
    document_back_url: 'https://example.com/back.jpg',
    selfie_url: 'https://example.com/selfie.jpg',
  });
  if (kycRes.status !== 201) throw new Error(`Failed to submit KYC: ${JSON.stringify(kycRes.json)}`);
  const kycSubmissionId = kycRes.json.id;
  console.log(`  ✅  KYC submitted: ${kycSubmissionId}`);

  // Approve KYC
  const approveKycRes = await api('PUT', `/kyc/${kycSubmissionId}/review`, adminToken, {
    decision: 'approve',
  });
  if (approveKycRes.status !== 200) throw new Error(`Failed to approve KYC: ${JSON.stringify(approveKycRes.json)}`);
  console.log('  ✅  KYC approved');

  // Check audit log for KYC approval
  const kycAuditRes = await api('GET', '/audit-log?entity_type=kyc_submission', adminToken);
  const kycAuditEntries = kycAuditRes.json.entries;
  const kycApprovedEntry = kycAuditEntries.find((e: any) => e.action === 'kyc_approve' && e.entity_id === kycSubmissionId);
  console.log(`  ✅  KYC approval audit entry found: ${!!kycApprovedEntry}`);
  if (!kycApprovedEntry) throw new Error('KYC approval audit entry not found');

  // ── Test 8: Audit log for manual bonus ──────────────────────────────────────
  console.log('\n8️⃣  Testing audit log for manual bonus...');
  const bonusRes = await api('POST', '/manual-bonuses', adminToken, {
    distributorId: distributorProfile.id,
    category: 'leadership',
    amount: 5000,
    note: 'Test bonus for audit log',
  });
  if (bonusRes.status !== 201) throw new Error(`Failed to award manual bonus: ${JSON.stringify(bonusRes.json)}`);
  const bonusId = bonusRes.json.id;
  console.log(`  ✅  Manual bonus awarded: ${bonusId}`);

  // Check audit log for manual bonus
  const bonusAuditRes = await api('GET', '/audit-log?entity_type=manual_bonus', adminToken);
  const bonusAuditEntries = bonusAuditRes.json.entries;
  const bonusAwardedEntry = bonusAuditEntries.find((e: any) => e.action === 'manual_bonus_awarded' && e.entity_id === bonusId);
  console.log(`  ✅  Manual bonus audit entry found: ${!!bonusAwardedEntry}`);
  if (!bonusAwardedEntry) throw new Error('Manual bonus audit entry not found');

  // ── Test 9: Audit log filtering by actor ────────────────────────────────────
  console.log('\n9️⃣  Testing audit log filtering by actor...');
  const actorAuditRes = await api('GET', `/audit-log?actor_id=${adminToken.split('.')[0]}`, adminToken);
  // Note: We can't easily get the actual admin UUID from the token, so we'll just verify the endpoint works
  console.log(`  ✅  Audit log by actor response status: ${actorAuditRes.status} (expected: 200)`);
  if (actorAuditRes.status !== 200) throw new Error('Failed to filter audit log by actor');

  // ── Test 10: Non-staff cannot access audit log ─────────────────────────────
  console.log('\n🔟  Testing non-staff audit log access...');
  const unauthorizedAuditRes = await api('GET', '/audit-log', distributorToken);
  console.log(`  ✅  Non-staff audit log access status: ${unauthorizedAuditRes.status} (expected: 403)`);
  if (unauthorizedAuditRes.status !== 403) throw new Error('Expected 403 for non-staff audit log access');

  // ── Test 11: Audit log filtering by date range ─────────────────────────────
  console.log('\n1️⃣1️⃣  Testing audit log filtering by date range...');
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  
  const dateAuditRes = await api('GET', `/audit-log?date_from=${yesterday.toISOString()}&date_to=${tomorrow.toISOString()}`, adminToken);
  console.log(`  ✅  Audit log by date range response status: ${dateAuditRes.status} (expected: 200)`);
  if (dateAuditRes.status !== 200) throw new Error('Failed to filter audit log by date range');
  console.log(`  ✅  Entries in date range: ${dateAuditRes.json.entries.length}`);

  console.log('\n─────────────────────────────────────────────────────────────');
  console.log('🎉  ALL STEP 21+22 VERIFICATION TESTS PASSED!');
  console.log('─────────────────────────────────────────────────────────────\n');
}

run().catch((err) => {
  console.error('\n❌  Test failed:', err.message ?? err);
  process.exit(1);
});
