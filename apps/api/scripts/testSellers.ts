// scripts/testSellers.ts — run with: npm -w api exec tsx -- scripts/testSellers.ts
import '../src/config/env.js';
import { login } from '../src/services/auth.service.js';
import { supabase } from '../src/config/supabase.js';

async function run() {
  console.log('🧪 Starting Step 3 Verification Test...\n');

  // 1. Log in as Admin to get the JWT
  console.log('1. Logging in as admin...');
  const loginRes = await login('ADMIN-001', 'ChangeMe123!');
  console.log(`✅ Admin logged in. Token: ${loginRes.token.slice(0, 30)}...`);

  // We need to fetch the country ID to create the seller
  const { data: country } = await supabase.from('countries').select('id').eq('iso_code', 'TZ').single();
  if (!country) {
    throw new Error('Country TZ not found');
  }
  const countryId = country.id;

  // Clean up any existing test user in auth and profile to make the test repeatable
  const { data: existingProfile } = await supabase
    .from('profiles')
    .select('id')
    .eq('distributor_id', 'BF-TZ-99999')
    .maybeSingle();

  if (existingProfile) {
    console.log('Cleaning up existing test user...');
    await supabase.auth.admin.deleteUser(existingProfile.id);
  }

  // 2. Call the server API to create a new seller
  console.log('2. Creating seller BF-TZ-99999 via Express endpoint...');
  const port = process.env.PORT || 3001;
  const createRes = await fetch(`http://localhost:${port}/api/sellers`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${loginRes.token}`
    },
    body: JSON.stringify({
      distributorId: 'BF-TZ-99999',
      fullName: 'John Doe Seller',
      phoneNumber: '+255712345678',
      password: 'SellerPass123!',
      countryId,
    })
  });

  if (!createRes.ok) {
    const text = await createRes.text();
    throw new Error(`Failed to create seller: ${createRes.status} ${text}`);
  }

  const newSeller = await createRes.json() as any;
  console.log(`✅ Seller created successfully! ID: ${newSeller.id}, Distributor ID: ${newSeller.distributorId}`);

  // 3. List sellers and verifyJohn Doe is there
  console.log('3. Fetching seller list...');
  const listRes = await fetch(`http://localhost:${port}/api/sellers`, {
    headers: { 'Authorization': `Bearer ${loginRes.token}` }
  });
  const list = await listRes.json() as any[];
  const found = list.find((s: any) => s.distributorId === 'BF-TZ-99999');
  if (found) {
    console.log('✅ Found newly created seller in list!');
  } else {
    throw new Error('Seller not found in list');
  }

  // 4. Test search query
  console.log('4. Searching for "99999"...');
  const searchRes = await fetch(`http://localhost:${port}/api/sellers?search=99999`, {
    headers: { 'Authorization': `Bearer ${loginRes.token}` }
  });
  const searchList = await searchRes.json() as any[];
  if (searchList.length === 1 && searchList[0].distributorId === 'BF-TZ-99999') {
    console.log('✅ Search query returned exactly the matching seller!');
  } else {
    throw new Error('Search failed to filter matching seller');
  }

  // 5. Authenticate as the new seller
  console.log('5. Logging in as the new seller (BF-TZ-99999)...');
  const sellerLogin = await login('BF-TZ-99999', 'SellerPass123!');
  console.log(`✅ Seller logged in. mustChangePassword is: ${sellerLogin.user.mustChangePassword}`);

  // 6. Reset seller's password via Admin
  console.log('6. Resetting password via admin endpoint...');
  const resetRes = await fetch(`http://localhost:${port}/api/sellers/${newSeller.id}/reset-password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${loginRes.token}`
    },
    body: JSON.stringify({
      newPassword: 'NewSellerPass123!'
    })
  });

  if (!resetRes.ok) {
    const text = await resetRes.text();
    throw new Error(`Failed to reset password: ${resetRes.status} ${text}`);
  }
  console.log('✅ Password reset response:', await resetRes.json());

  // 7. Verify login with the new password works
  console.log('7. Logging in as seller with new password...');
  const sellerNewLogin = await login('BF-TZ-99999', 'NewSellerPass123!');
  console.log('✅ Seller logged in successfully with new password!');

  console.log('\n🎉 ALL STEP 3 VERIFICATION TESTS PASSED SUCCESSFULLY! 🎉');
}

run().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
