// scripts/testSellersReqs.ts — run with: npm -w api exec tsx -- scripts/testSellersReqs.ts
import '../src/config/env.js';
import { login } from '../src/services/auth.service.js';
import { supabase } from '../src/config/supabase.js';

async function run() {
  console.log('🧪 Starting Seller Management verification tests...\n');
  const port = process.env.PORT || 3001;

  // Step 1: Admin Login
  console.log('Step 1: Logging in as seeded admin (ADMIN-001)...');
  const adminLogin = await login('ADMIN-001', 'ChangeMe123!');
  console.log(`✅ Admin logged in. Token: ${adminLogin.token.slice(0, 30)}...`);

  // Get country ID
  const { data: country } = await supabase.from('countries').select('id').eq('iso_code', 'TZ').single();
  if (!country) {
    throw new Error('Country TZ not found');
  }
  const countryId = country.id;

  // Cleanup pre-existing test seller to make test repeatable
  const { data: existingProfile } = await supabase
    .from('profiles')
    .select('id')
    .eq('distributor_id', 'BF-TZ-77777')
    .maybeSingle();

  if (existingProfile) {
    console.log('Cleaning up existing test user...');
    await supabase.auth.admin.deleteUser(existingProfile.id);
  }

  // 1. POST /api/sellers - create a second seller (plain distributor)
  console.log('2. Creating a second seller BF-TZ-77777 via POST /api/sellers (Admin context)...');
  const createRes = await fetch(`http://localhost:${port}/api/sellers`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminLogin.token}`
    },
    body: JSON.stringify({
      distributorId: 'BF-TZ-77777',
      fullName: 'Alice Test Seller',
      phoneNumber: '+255799999999',
      password: 'AliceSellerPass123!',
      countryId,
    })
  });

  if (!createRes.ok) {
    const text = await createRes.text();
    throw new Error(`Failed to create seller: ${createRes.status} ${text}`);
  }

  const newProfile = await createRes.json() as any;
  console.log('✅ Response status: 201 Created');
  console.log('✅ Returned profile details:', JSON.stringify(newProfile, null, 2));

  if (newProfile.password !== undefined || newProfile.password_hash !== undefined) {
    throw new Error('❌ Security check failed: response contains password fields!');
  }
  console.log('✅ Security check passed: no password fields returned.');

  // 2. Log in as new seller via /api/auth/login
  console.log('3. Logging in as new seller via /api/auth/login...');
  const sellerLogin = await login('BF-TZ-77777', 'AliceSellerPass123!');
  console.log(`✅ Seller logged in. mustChangePassword is: ${sellerLogin.user.mustChangePassword}`);
  if (sellerLogin.user.mustChangePassword !== true) {
    throw new Error('❌ mustChangePassword flag should be true on first login!');
  }

  // 3. GET /api/sellers?search=<part of name>
  console.log('4. Searching seller list for "Alice"...');
  const searchRes = await fetch(`http://localhost:${port}/api/sellers?search=Alice`, {
    headers: { 'Authorization': `Bearer ${adminLogin.token}` }
  });
  const searchList = await searchRes.json() as any[];
  console.log(`✅ Search result returned ${searchList.length} matches.`);
  const found = searchList.find((s: any) => s.distributorId === 'BF-TZ-77777');
  if (found) {
    console.log(`✅ Found Alice with directDownlineCount: ${found.directDownlineCount} and countryName: ${found.countryName}`);
  } else {
    throw new Error('❌ Alice was not found in search results');
  }

  // 4. Try POST /api/sellers using the new seller's token (should be 403 Forbidden)
  console.log('5. Testing staff-only access control by using seller token to create a seller...');
  const badCreateRes = await fetch(`http://localhost:${port}/api/sellers`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${sellerLogin.token}`
    },
    body: JSON.stringify({
      distributorId: 'BF-TZ-88888',
      fullName: 'Fail User',
      phoneNumber: '+255711111111',
      password: 'FailUserPass123!',
      countryId,
    })
  });

  console.log(`✅ Status returned: ${badCreateRes.status}`);
  if (badCreateRes.status === 403) {
    console.log('✅ Request successfully rejected with 403 Forbidden!');
  } else {
    throw new Error(`❌ Security flaw: expected 403 but got ${badCreateRes.status}`);
  }

  // 5. Test deactivateSeller via PATCH /api/sellers/:id/deactivate
  console.log('6. Deactivating seller via PATCH /api/sellers/:id/deactivate...');
  const deactivateRes = await fetch(`http://localhost:${port}/api/sellers/${newProfile.id}/deactivate`, {
    method: 'PATCH',
    headers: { 'Authorization': `Bearer ${adminLogin.token}` }
  });

  if (!deactivateRes.ok) {
    throw new Error(`Deactivate failed: ${deactivateRes.status}`);
  }
  console.log('✅ Deactivate response:', await deactivateRes.json());

  // Confirm seller is deactivated in DB
  const { data: updatedProfile } = await supabase.from('profiles').select('is_active').eq('id', newProfile.id).single();
  console.log(`✅ Seller is_active status in DB: ${updatedProfile?.is_active}`);
  if (updatedProfile?.is_active !== false) {
    throw new Error('❌ Seller profile was not soft deleted (is_active is still true)');
  }

  console.log('\n🎉 ALL SELLER MANAGEMENT VERIFICATION TESTS PASSED SUCCESSFULLY! 🎉');
}

run().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
