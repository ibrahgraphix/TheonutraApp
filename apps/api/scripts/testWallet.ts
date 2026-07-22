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
  console.log('🧪  Step 15 — Wallet + Withdrawals Verification Tests\n');

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

  // ── Get or create test product ───────────────────────────────────────────
  const { data: existingProduct } = await supabase
    .from('products')
    .select('id, name, pv')
    .eq('name', 'Wallet Test Product')
    .eq('is_active', true)
    .maybeSingle();

  let productId: string;
  let productPV = 100;
  if (existingProduct) {
    productId = existingProduct.id as string;
    productPV = Number(existingProduct.pv ?? 100);
    console.log(`  ✅  Found existing product: ${productId} (PV: ${productPV})`);
  } else {
    const createRes = await api('POST', '/products', adminToken, {
      name: 'Wallet Test Product',
      description: 'Product for testing wallet functionality',
      pv: productPV,
      prices: [{ countryId: tzId, price: 100000, distributorPrice: 80000, isAvailable: true }],
    });
    if (createRes.status !== 201) {
      throw new Error(`Failed to create product: ${JSON.stringify(createRes.json)}`);
    }
    productId = createRes.json.id;
    console.log(`  ✅  Created product: ${productId}`);
  }

  // ── Create recruiter and recruit ──────────────────────────────────────────
  const recruiterId = `W-REC-${Date.now()}`;
  const recruiterRes = await api('POST', '/sellers', adminToken, {
    distributorId: recruiterId,
    fullName: 'Wallet Recruiter',
    phoneNumber: `+255799${Date.now().toString().slice(-6)}`,
    password: 'RecPass123!',
    countryId: tzId,
  });
  if (recruiterRes.status !== 201) throw new Error(`Failed to create recruiter: ${JSON.stringify(recruiterRes.json)}`);
  const recruiterProfile = recruiterRes.json;
  console.log(`  ✅  Recruiter created: ${recruiterId} (id: ${recruiterProfile.id})`);

  const recruitId = `W-RCT-${Date.now()}`;
  const recruitRes = await api('POST', '/sellers', adminToken, {
    distributorId: recruitId,
    fullName: 'Wallet Recruit',
    phoneNumber: `+255788${Date.now().toString().slice(-6)}`,
    password: 'RctPass123!',
    countryId: tzId,
    referredBy: recruiterProfile.id,
  });
  if (recruitRes.status !== 201) throw new Error(`Failed to create recruit: ${JSON.stringify(recruitRes.json)}`);
  const recruitProfile = recruitRes.json;
  console.log(`  ✅  Recruit created: ${recruitId} (id: ${recruitProfile.id})`);

  // Login as recruiter to inspect initial wallet
  console.log('\n1️⃣  Checking initial wallet state...');
  const recruiterToken = (await login(recruiterId, 'RecPass123!')).token;
  const initialWalletRes = await api('GET', '/wallet/me', recruiterToken);
  if (initialWalletRes.status !== 200) throw new Error(`Failed to get initial wallet: ${JSON.stringify(initialWalletRes.json)}`);
  console.log(`  ✅ Initial wallet balance: ${initialWalletRes.json.balance} (expected 0)`);
  if (initialWalletRes.json.balance !== 0) throw new Error(`Expected balance 0, got ${initialWalletRes.json.balance}`);

  // ── Test 1: Commission auto-credits wallet ──────────────────────────────
  console.log('\n2️⃣  Testing commission auto-crediting...');
  // Recruit buys 1 unit of product
  const recruitToken = (await login(recruitId, 'RctPass123!')).token;
  const orderRes = await api('POST', '/orders', recruitToken, {
    countryId: tzId,
    items: [{ productId, quantity: 1 }],
  });
  if (orderRes.status !== 201) throw new Error(`Failed to create order: ${JSON.stringify(orderRes.json)}`);
  const order = orderRes.json;

  // Recruiter gets level 1 commission. Pay order and confirm.
  const payRes = await api('POST', '/payments/bank', recruitToken, {
    orderId: order.id,
    referenceNo: `W-PAY-${Date.now()}`,
  });
  if (payRes.status !== 201) throw new Error(`Failed to submit payment: ${JSON.stringify(payRes.json)}`);
  const payment = payRes.json;

  const confirmRes = await api('PATCH', `/payments/${payment.id}/confirm`, adminToken);
  if (confirmRes.status !== 200) throw new Error(`Failed to confirm payment: ${JSON.stringify(confirmRes.json)}`);
  console.log('  ✅ Order payment confirmed. Commission should be created.');

  // Read the actual commission amount from the DB — avoids hardcoding the commission rate
  const { data: commissionRows, error: commissionFetchError } = await supabase
    .from('commissions')
    .select('amount')
    .eq('beneficiary_id', recruiterProfile.id)
    .order('created_at', { ascending: false })
    .limit(1);
  if (commissionFetchError || !commissionRows || commissionRows.length === 0) {
    throw new Error(`No commission found for recruiter: ${commissionFetchError?.message}`);
  }
  const expectedCommission = Number(commissionRows[0].amount);
  console.log(`  ℹ️  Actual commission amount from DB: ${expectedCommission}`);

  // Fetch recruiter wallet and verify credit
  const afterCommissionWalletRes = await api('GET', '/wallet/me', recruiterToken);
  if (afterCommissionWalletRes.status !== 200) throw new Error(`Failed to fetch wallet: ${JSON.stringify(afterCommissionWalletRes.json)}`);
  const walletAfterCommission = Number(afterCommissionWalletRes.json.balance);
  
  console.log(`  ✅ Wallet balance after commission: ${walletAfterCommission} (expected: ${expectedCommission})`);
  if (Math.abs(walletAfterCommission - expectedCommission) > 0.01) {
    throw new Error(`Expected balance ${expectedCommission}, got ${walletAfterCommission}`);
  }

  // Verify recent transactions contains the commission credit with correct balance_after
  const recentTransactions = afterCommissionWalletRes.json.recentTransactions;
  console.log(`  ✅ Wallet transactions count: ${recentTransactions.length} (expected 1)`);
  if (recentTransactions.length !== 1) throw new Error(`Expected 1 transaction, got ${recentTransactions.length}`);
  const commissionTx = recentTransactions[0];
  console.log(`  ✅ Transaction: type=${commissionTx.type}, source_type=${commissionTx.source_type}, amount=${commissionTx.amount}, balance_after=${commissionTx.balance_after}`);
  if (commissionTx.type !== 'credit' || commissionTx.source_type !== 'commission') {
    throw new Error(`Commission transaction details mismatch: type=${commissionTx.type} source_type=${commissionTx.source_type}`);
  }
  if (Math.abs(Number(commissionTx.balance_after) - walletAfterCommission) > 0.01) {
    throw new Error(`balance_after in ledger (${commissionTx.balance_after}) does not match wallet balance (${walletAfterCommission})`);
  }
  console.log('  ✅ Commission credit transaction and balance_after verified!');

  // ── Test 2: Team bonus batch run auto-credits wallet ─────────────────────
  console.log('\n3️⃣  Testing team bonus batch run auto-crediting...');
  // Promote recruiter to Silver rank so they unlock 3 levels of team bonus
  const { data: silverRank } = await supabase
    .from('ranks')
    .select('id')
    .eq('name', 'Silver')
    .single();
  if (!silverRank) throw new Error('Silver rank not found');
  const promoteRes = await api('PATCH', `/ranks/${recruiterProfile.id}/promote`, adminToken, {
    newRankId: silverRank.id,
  });
  if (promoteRes.status !== 200) throw new Error(`Failed to promote recruiter: ${JSON.stringify(promoteRes.json)}`);
  console.log('  ✅ Recruiter promoted to Silver rank');

  // Run team bonus batch for the current month
  const now = new Date();
  const currentPeriod = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  
  const batchRes = await api('POST', '/team-bonus/run', adminToken, { period: currentPeriod });
  if (batchRes.status !== 200) throw new Error(`Failed to run team bonus batch: ${JSON.stringify(batchRes.json)}`);
  console.log('  ✅ Team bonus batch run complete:', JSON.stringify(batchRes.json));

  // Read actual team bonus amount from DB
  const { data: bonusRows, error: bonusFetchError } = await supabase
    .from('commissions')
    .select('amount')
    .eq('beneficiary_id', recruiterProfile.id)
    .eq('bonus_type', 'team_bonus')
    .order('created_at', { ascending: false })
    .limit(1);
  if (bonusFetchError || !bonusRows || bonusRows.length === 0) {
    throw new Error(`No team bonus found for recruiter: ${bonusFetchError?.message}`);
  }
  const actualTeamBonus = Number(bonusRows[0].amount);
  const expectedBalanceAfterBonus = walletAfterCommission + actualTeamBonus;
  console.log(`  ℹ️  Actual team bonus amount from DB: ${actualTeamBonus}`);

  // Fetch recruiter wallet and verify credit
  const afterBonusWalletRes = await api('GET', '/wallet/me', recruiterToken);
  const walletAfterBonus = Number(afterBonusWalletRes.json.balance);
  console.log(`  ✅ Wallet balance after team bonus: ${walletAfterBonus} (expected: ${expectedBalanceAfterBonus})`);
  if (Math.abs(walletAfterBonus - expectedBalanceAfterBonus) > 0.01) {
    throw new Error(`Expected balance ${expectedBalanceAfterBonus}, got ${walletAfterBonus}`);
  }

  // Verify a team_bonus credit transaction was logged
  const afterBonusTransactions = afterBonusWalletRes.json.recentTransactions;
  console.log(`  ✅ Wallet transactions count: ${afterBonusTransactions.length} (expected 2)`);
  if (afterBonusTransactions.length !== 2) throw new Error(`Expected 2 transactions, got ${afterBonusTransactions.length}`);
  const teamBonusTx = afterBonusTransactions.find((tx: any) => tx.source_type === 'team_bonus');
  if (!teamBonusTx) throw new Error('Team bonus transaction not found in ledger');
  console.log(`  ✅ Team Bonus tx: type=${teamBonusTx.type}, source_type=${teamBonusTx.source_type}, amount=${teamBonusTx.amount}, balance_after=${teamBonusTx.balance_after}`);
  if (teamBonusTx.type !== 'credit' || Math.abs(Number(teamBonusTx.amount) - actualTeamBonus) > 0.01) {
    throw new Error('Team bonus transaction details mismatch');
  }

  // ── Test 3: Withdrawal request reserves balance & blocks over-balance ─────
  console.log('\n4️⃣  Testing withdrawal request...');
  // Request withdrawal with amount > balance
  const overBalanceRes = await api('POST', '/wallet/withdrawals', recruiterToken, {
    amount: expectedBalanceAfterBonus + 100,
    method: 'bank',
    payoutDetails: 'Bank XYZ, Acc: 123456',
  });
  console.log(`  ✅ Over-balance request status: ${overBalanceRes.status} (expected 400)`);
  if (overBalanceRes.status !== 400) throw new Error(`Expected status 400 for over-balance withdrawal, got ${overBalanceRes.status}`);

  // Request withdrawal with valid amount
  const withdrawalAmount = 2000;
  const validRequestRes = await api('POST', '/wallet/withdrawals', recruiterToken, {
    amount: withdrawalAmount,
    method: 'bank',
    payoutDetails: 'Bank XYZ, Acc: 123456',
  });
  if (validRequestRes.status !== 201) throw new Error(`Failed to submit withdrawal: ${JSON.stringify(validRequestRes.json)}`);
  const withdrawalId = validRequestRes.json.id;
  console.log(`  ✅ Withdrawal request submitted. ID: ${withdrawalId}`);

  // Check wallet balance was reserved (reduced immediately)
  const afterRequestWalletRes = await api('GET', '/wallet/me', recruiterToken);
  const expectedReservedBalance = walletAfterBonus - withdrawalAmount;
  console.log(`  ✅ Wallet balance after request (reserved): ${afterRequestWalletRes.json.balance} (expected: ${expectedReservedBalance})`);
  if (Math.abs(Number(afterRequestWalletRes.json.balance) - expectedReservedBalance) > 0.01) {
    throw new Error(`Expected balance ${expectedReservedBalance}, got ${afterRequestWalletRes.json.balance}`);
  }

  // Check that no new wallet transaction has been written yet (still 2 transactions)
  const afterRequestTxCount = afterRequestWalletRes.json.recentTransactions.length;
  console.log(`  ✅ Wallet transactions count during pending: ${afterRequestTxCount} (expected 2)`);
  if (afterRequestTxCount !== 2) throw new Error(`Expected transaction count to remain 2, got ${afterRequestTxCount}`);

  // ── Test 4: Rejected withdrawal refunds balance ─────────────────────────
  console.log('\n5️⃣  Testing rejection & refund...');
  const rejectRes = await api('PUT', `/wallet/withdrawals/${withdrawalId}/reject`, adminToken, {
    notes: 'Invalid account number details',
  });
  if (rejectRes.status !== 200) throw new Error(`Failed to reject withdrawal: ${JSON.stringify(rejectRes.json)}`);
  console.log('  ✅ Withdrawal rejected by staff.');

  // Fetch recruiter wallet again and verify balance is refunded (restored to pre-request level)
  const afterRejectWalletRes = await api('GET', '/wallet/me', recruiterToken);
  console.log(`  ✅ Wallet balance after rejection (refunded): ${afterRejectWalletRes.json.balance} (expected: ${walletAfterBonus})`);
  if (Math.abs(Number(afterRejectWalletRes.json.balance) - walletAfterBonus) > 0.01) {
    throw new Error(`Expected balance ${walletAfterBonus}, got ${afterRejectWalletRes.json.balance}`);
  }

  // Check that the request status is 'rejected'
  const historyRes = await api('GET', '/wallet/withdrawals', recruiterToken);
  const rejectedRequest = historyRes.json.find((r: any) => r.id === withdrawalId);
  console.log(`  ✅ Withdrawal status: ${rejectedRequest.status} (expected: rejected)`);
  console.log(`  ✅ Withdrawal notes: "${rejectedRequest.notes}" (expected: Invalid account number details)`);
  if (rejectedRequest.status !== 'rejected' || rejectedRequest.notes !== 'Invalid account number details') {
    throw new Error('Rejection details mismatch');
  }

  // Check that still no transaction has been written
  const afterRejectTxCount = afterRejectWalletRes.json.recentTransactions.length;
  console.log(`  ✅ Wallet transactions count after rejection: ${afterRejectTxCount} (expected 2)`);
  if (afterRejectTxCount !== 2) throw new Error(`Expected transaction count to remain 2, got ${afterRejectTxCount}`);

  // ── Test 5: Approval debits balance and logs ledger transaction ─────────
  console.log('\n6️⃣  Testing approval & ledger debit...');
  // Request withdrawal again
  const secondWithdrawalAmount = 3000;
  const secondRequestRes = await api('POST', '/wallet/withdrawals', recruiterToken, {
    amount: secondWithdrawalAmount,
    method: 'mobile_money',
    payoutDetails: 'M-Pesa, Phone: +255711223344',
  });
  if (secondRequestRes.status !== 201) throw new Error(`Failed to submit second withdrawal: ${JSON.stringify(secondRequestRes.json)}`);
  const secondWithdrawalId = secondRequestRes.json.id;
  console.log(`  ✅ Second withdrawal request submitted. ID: ${secondWithdrawalId}`);

  // Approve the second request
  const approveRes = await api('PUT', `/wallet/withdrawals/${secondWithdrawalId}/approve`, adminToken);
  if (approveRes.status !== 200) throw new Error(`Failed to approve second withdrawal: ${JSON.stringify(approveRes.json)}`);
  console.log('  ✅ Second withdrawal approved by staff.');

  // Fetch recruiter wallet again and verify balance is still debited
  const afterApproveWalletRes = await api('GET', '/wallet/me', recruiterToken);
  const expectedBalanceAfterApprove = walletAfterBonus - secondWithdrawalAmount;
  console.log(`  ✅ Wallet balance after approval: ${afterApproveWalletRes.json.balance} (expected: ${expectedBalanceAfterApprove})`);
  if (Math.abs(Number(afterApproveWalletRes.json.balance) - expectedBalanceAfterApprove) > 0.01) {
    throw new Error(`Expected balance ${expectedBalanceAfterApprove}, got ${afterApproveWalletRes.json.balance}`);
  }

  // Check that a new debit transaction has been logged
  const afterApproveTxCount = afterApproveWalletRes.json.recentTransactions.length;
  console.log(`  ✅ Wallet transactions count after approval: ${afterApproveTxCount} (expected 3)`);
  if (afterApproveTxCount !== 3) throw new Error(`Expected transaction count to be 3, got ${afterApproveTxCount}`);
  
  const debitTx = afterApproveWalletRes.json.recentTransactions[0];
  console.log(`  ✅ Debit transaction: type=${debitTx.type}, source_type=${debitTx.source_type}, amount=${debitTx.amount}, balance_after=${debitTx.balance_after}`);
  if (debitTx.type !== 'debit' || debitTx.source_type !== 'withdrawal' || Math.abs(Number(debitTx.amount) - secondWithdrawalAmount) > 0.01 || Math.abs(Number(debitTx.balance_after) - expectedBalanceAfterApprove) > 0.01) {
    throw new Error('Debit transaction details mismatch');
  }

  // ── Test 6: Full ledger reconciliation ───────────────────────────────────
  console.log('\n7️⃣  Checking ledger reconciliation...');
  // Sum up all transactions: credits are positive, debits are negative
  const txHistoryRes = await api('GET', '/wallet/transactions', recruiterToken);
  const allTxs = txHistoryRes.json.transactions;
  const ledgerSum = allTxs.reduce((sum: number, tx: any) => {
    const val = Number(tx.amount);
    return sum + (tx.type === 'credit' ? val : -val);
  }, 0);

  console.log(`  ✅ Sum of all transaction amounts in ledger: ${ledgerSum}`);
  console.log(`  ✅ Current wallet balance: ${afterApproveWalletRes.json.balance}`);
  if (Math.abs(ledgerSum - afterApproveWalletRes.json.balance) > 0.01) {
    throw new Error(`Ledger does not reconcile! Sum of transactions is ${ledgerSum}, current balance is ${afterApproveWalletRes.json.balance}`);
  }
  console.log('  ✅ Ledger reconciles perfectly!');

  // ── Test 7: Mark approved withdrawal request as paid ─────────────────────
  console.log('\n8️⃣  Testing mark withdrawal as paid...');
  const payRequestRes = await api('PUT', `/wallet/withdrawals/${secondWithdrawalId}/mark-paid`, adminToken);
  if (payRequestRes.status !== 200) throw new Error(`Failed to mark withdrawal as paid: ${JSON.stringify(payRequestRes.json)}`);
  console.log('  ✅ Second withdrawal marked as paid by staff.');

  // Check that status is paid
  const secondHistoryRes = await api('GET', '/wallet/withdrawals', recruiterToken);
  const paidRequest = secondHistoryRes.json.find((r: any) => r.id === secondWithdrawalId);
  console.log(`  ✅ Withdrawal status: ${paidRequest.status} (expected: paid)`);
  if (paidRequest.status !== 'paid') {
    throw new Error('Status mismatch when marked as paid');
  }

  console.log('\n─────────────────────────────────────────────────────────────');
  console.log('🎉  ALL STEP 15 VERIFICATION TESTS PASSED!');
  console.log('─────────────────────────────────────────────────────────────\n');
}

run().catch((err) => {
  console.error('\n❌  Test failed:', err.message ?? err);
  process.exit(1);
});
