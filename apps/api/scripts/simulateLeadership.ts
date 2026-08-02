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

  // 3. Clean up existing test distributors
  const testDistributorIds = ['BF-TZ-LEADER', 'BF-TZ-DOWN1', 'BF-TZ-DOWN2', 'BF-TZ-DOWN3'];
  for (const distId of testDistributorIds) {
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('distributor_id', distId)
      .maybeSingle();

    if (existingProfile) {
      console.log(`Cleaning up existing test user ${distId}...`);
      await supabase.auth.admin.deleteUser(existingProfile.id);
    }
  }

  // 4. Create main distributor who will reach leadership
  console.log('2. Creating main distributor BF-TZ-LEADER...');
  const createLeaderRes = await fetch(`http://localhost:${port}/api/sellers`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${loginRes.token}`
    },
    body: JSON.stringify({
      distributorId: 'BF-TZ-LEADER',
      fullName: 'Leader Distributor',
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
    const distId = `BF-TZ-DOWN${i}`;
    console.log(`3.${i}. Creating downline distributor ${distId}...`);
    
    const createDownRes = await fetch(`http://localhost:${port}/api/sellers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${loginRes.token}`
      },
      body: JSON.stringify({
        distributorId: distId,
        fullName: `Downline Distributor ${i}`,
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

  // 10. Manually set leadership rank for the leader
  console.log('\n7. Setting leadership rank for leader...');
  const { data: slRank } = await supabase
    .from('leadership_ranks')
    .select('id')
    .eq('name', 'SL')
    .single();

  if (slRank) {
    await supabase
      .from('profiles')
      .update({ leadership_rank_id: slRank.id })
      .eq('id', leader.id);
    console.log('✅ Leader set to SL (Silver Leadership) rank');
  }

  // 11. Set active status ranks for downline to qualify as leaders
  console.log('8. Setting active status ranks for downline distributors...');
  const { data: lRank } = await supabase
    .from('active_status_ranks')
    .select('id')
    .eq('name', 'L')
    .single();

  if (lRank) {
    for (const downDist of downlineDistributors) {
      await supabase
        .from('profiles')
        .update({ active_status_rank_id: lRank.id })
        .eq('id', downDist.id);
    }
    console.log('✅ All downline distributors set to L rank');
  }

  // 12. Update lifetime CGV for leader to meet requirements
  console.log('9. Updating lifetime CGV for leader...');
  await supabase
    .from('profiles')
    .update({ lifetime_cgv: 1000 })
    .eq('id', leader.id);
  console.log('✅ Leader lifetime CGV set to 1000');

  console.log('\n🎉 Leadership simulation completed! 🎉');
  console.log('\nYou can now log in as BF-TZ-LEADER with password LeaderPass123! to see the results in the frontend.');
  console.log('Leader has been set to SL (Silver Leadership) rank with 3 qualified downline leaders.');
}

run().catch((err) => {
  console.error('❌ Simulation failed:', err);
  process.exit(1);
});
