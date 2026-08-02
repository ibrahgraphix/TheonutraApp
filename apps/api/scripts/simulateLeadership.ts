// scripts/simulateLeadership.ts — run with: npm -w api exec tsx -- scripts/simulateLeadership.ts
import '../src/config/env.js';
import { login } from '../src/services/auth.service.js';
import { supabase } from '../src/config/supabase.js';

async function run() {
  console.log('🧪 Simulating distributor reaching leadership level...\n');

  // 1. Log in as Admin to get the JWT
  console.log('1. Logging in as admin...');
  const loginRes = await login('ADMIN-001', 'ChangeMe123!');
  console.log(`✅ Admin logged in. Token: ${loginRes.token.slice(0, 30)}...`);

  const port = process.env.PORT || 3001;

  // 2. Get country ID for Tanzania
  const { data: country } = await supabase.from('countries').select('id').eq('iso_code', 'TZ').single();
  if (!country) {
    throw new Error('Country TZ not found');
  }
  const countryId = country.id;

  // 3. Clean up existing test distributors and their profiles
  const testDistributorIds = ['BF-TZ-LEADER-TEST', 'BF-TZ-DOWN1-TEST', 'BF-TZ-DOWN2-TEST', 'BF-TZ-DOWN3-TEST'];
  for (const distId of testDistributorIds) {
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('distributor_id', distId)
      .maybeSingle();

    if (existingProfile) {
      console.log(`Cleaning up existing test user ${distId}...`);
      // Delete from auth first
      try {
        await supabase.auth.admin.deleteUser(existingProfile.id);
      } catch (authError) {
        console.log(`Auth deletion failed for ${distId}, continuing...`);
      }
      // Delete from profiles table directly
      await supabase.from('profiles').delete().eq('id', existingProfile.id);
    }
  }

  // 4. Create main distributor who will reach leadership
  console.log('2. Creating main distributor BF-TZ-LEADER-TEST...');
  const createLeaderRes = await fetch(`http://localhost:${port}/api/sellers`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${loginRes.token}`
    },
    body: JSON.stringify({
      distributorId: 'BF-TZ-LEADER-TEST',
      fullName: 'Leader Distributor Test',
      phoneNumber: '+255711111111',
      password: 'LeaderPass123!',
      countryId,
    })
  });

  if (!createLeaderRes.ok) {
    const text = await createLeaderRes.text();
    throw new Error(`Failed to create leader: ${createLeaderRes.status} ${text}`);
  }

  const leader = await createLeaderRes.json() as any;
  console.log(`✅ Leader created! ID: ${leader.id}, Distributor ID: ${leader.distributorId}`);

  // 5. Create 3 downline distributors under the leader
  const downlineDistributors: any[] = [];
  for (let i = 1; i <= 3; i++) {
    const distId = `BF-TZ-DOWN${i}-TEST`;
    console.log(`3.${i}. Creating downline distributor ${distId}...`);
    
    const createDownRes = await fetch(`http://localhost:${port}/api/sellers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${loginRes.token}`
      },
      body: JSON.stringify({
        distributorId: distId,
        fullName: `Downline Distributor ${i} Test`,
        phoneNumber: `+25571111111${i}`,
        password: `DownPass${i}123!`,
        countryId,
        referredBy: leader.id, // Set the leader as referrer
      })
    });

    if (!createDownRes.ok) {
      const text = await createDownRes.text();
      throw new Error(`Failed to create downline ${i}: ${createDownRes.status} ${text}`);
    }

    const downDist = await createDownRes.json() as any;
    downlineDistributors.push(downDist);
    console.log(`✅ Downline ${i} created! ID: ${downDist.id}`);
  }

  // 6. Get products to create orders
  const { data: products } = await supabase
    .from('products')
    .select('id, name, pv')
    .eq('is_active', true)
    .limit(5);

  if (!products || products.length === 0) {
    throw new Error('No active products found');
  }

  console.log(`\n4. Found ${products.length} products to create orders with`);

  // 7. Get product pricing for TZS
  const { data: productPricing } = await supabase
    .from('product_pricing')
    .select('product_id, distributor_price')
    .eq('country_id', countryId)
    .in('product_id', products.map(p => p.id));

  const priceMap = new Map();
  for (const pp of productPricing || []) {
    priceMap.set(pp.product_id, pp.distributor_price);
  }

  // 8. Create orders for the leader (high PPV) directly in database
  console.log('5. Creating orders for leader to build PPV...');
  const leaderOrderCount = 10;
  for (let i = 0; i < leaderOrderCount; i++) {
    const product = products[i % products.length];
    const price = priceMap.get(product.id) || 50000;
    const quantity = 5;
    
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        buyer_id: leader.id,
        total_amount: price * quantity,
        currency_code: 'TZS',
        status: 'paid',
        country_id: countryId,
      })
      .select('id')
      .single();

    if (orderError) {
      console.warn(`Warning: Failed to create order ${i+1} for leader: ${orderError.message}`);
    } else {
      // Create order items
      await supabase.from('order_items').insert({
        order_id: order.id,
        product_id: product.id,
        quantity: quantity,
        unit_price: price,
      });
    }
  }
  console.log(`✅ Created ${leaderOrderCount} orders for leader`);

  // 9. Create orders for downline distributors directly in database
  for (let i = 0; i < downlineDistributors.length; i++) {
    const downDist = downlineDistributors[i];
    console.log(`6.${i+1}. Creating orders for downline ${i+1}...`);
    
    const orderCount = 5;
    for (let j = 0; j < orderCount; j++) {
      const product = products[j % products.length];
      const price = priceMap.get(product.id) || 50000;
      const quantity = 3;
      
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          buyer_id: downDist.id,
          total_amount: price * quantity,
          currency_code: 'TZS',
          status: 'paid',
          country_id: countryId,
        })
        .select('id')
        .single();

      if (orderError) {
        console.warn(`Warning: Failed to create order ${j+1} for downline ${i+1}: ${orderError.message}`);
      } else {
        // Create order items
        await supabase.from('order_items').insert({
          order_id: order.id,
          product_id: product.id,
          quantity: quantity,
          unit_price: price,
        });
      }
    }
    console.log(`✅ Created ${orderCount} orders for downline ${i+1}`);
  }

  // 10. Set leader to Star 7 first (required for leadership ranks)
  console.log('\n7. Setting leader to Star 7 (required for leadership)...');
  const { data: star7Rank } = await supabase
    .from('star_ranks')
    .select('id')
    .eq('code', 'LEAD_STAR_7')
    .single();

  if (star7Rank) {
    await supabase
      .from('profiles')
      .update({ star_rank_id: star7Rank.id, lifetime_cgv: 12000 })
      .eq('id', leader.id);
    console.log('✅ Leader set to Star 7 with 12,000 lifetime CGV');
  }

  // 11. Set downline distributors to Star 7 as well (to qualify as leaders)
  console.log('8. Setting downline distributors to Star 7 to qualify as leaders...');
  if (star7Rank) {
    for (const downDist of downlineDistributors) {
      await supabase
        .from('profiles')
        .update({ star_rank_id: star7Rank.id, lifetime_cgv: 5000, is_active: true })
        .eq('id', downDist.id);
    }
    console.log('✅ All downline distributors set to Star 7 and active');
  } else {
    console.log('❌ Star 7 rank not found, skipping downline rank assignment');
  }

  // 12. Set yearly GPV for leader to meet SL requirements
  console.log('9. Setting yearly GPV for leader to meet SL requirements...');
  const currentYear = new Date().getUTCFullYear();
  await supabase
    .from('distributor_yearly_gpv')
    .upsert({
      distributor_id: leader.id,
      year: currentYear,
      total_gpv: 45000, // Above SL requirement of 40,000
    }, { onConflict: 'distributor_id,year' });
  console.log('✅ Leader yearly GPV set to 45,000 (above SL requirement of 40,000)');

  // 13. Set leadership rank to SL (Senior Leader)
  console.log('10. Setting leadership rank to SL...');
  const { data: slRank } = await supabase
    .from('leadership_ranks')
    .select('id')
    .eq('code', 'SL')
    .single();

  if (slRank) {
    await supabase
      .from('profiles')
      .update({ leadership_rank_id: slRank.id })
      .eq('id', leader.id);
    console.log('✅ Leader set to SL (Senior Leader) rank');
  }

  console.log('\n🎉 Leadership simulation completed! 🎉');
  console.log('\nYou can now log in as BF-TZ-LEADER-TEST with password LeaderPass123! to see the results in the frontend.');
  console.log('Leader has been set to SL (Senior Leader) rank with:');
  console.log('- Star 7 rank with 12,000 lifetime CGV');
  console.log('- 45,000 yearly GPV (above 40,000 requirement)');
  console.log('- 3 qualified downline leaders (Star 7)');
}

run().catch((err) => {
  console.error('❌ Simulation failed:', err);
  process.exit(1);
});
