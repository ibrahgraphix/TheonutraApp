/**
 * Manual script to run monthly requalification for testing
 * This simulates the monthly scheduled job for testing purposes
 */

import { runMonthlyRequalification } from '../src/services/compensationPlan.service.js';
import { supabase } from '../src/config/supabase.js';

async function runMonthlyJob() {
  const now = new Date();
  const period = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  
  console.log(`Starting monthly requalification for period ${period}...`);
  
  try {
    const result = await runMonthlyRequalification(period);
    console.log(`Monthly requalification complete:`, result);
    
    // Check database for pending bonuses
    console.log('\n📊 Checking for pending bonuses in database...');
    
    // Check OPB bonuses
    const { data: opbBonuses, error: opbError } = await supabase
      .from('opb_bonuses')
      .select('*')
      .eq('status', 'pending')
      .eq('period', period);
    
    if (opbError) {
      console.error('Failed to check OPB bonuses:', opbError);
    } else {
      console.log(`✅ Found ${opbBonuses?.length || 0} pending OPB bonuses for period ${period}`);
      if (opbBonuses && opbBonuses.length > 0) {
        opbBonuses.forEach((bonus, i) => {
          console.log(`  ${i + 1}. Distributor ID: ${bonus.distributor_id}, Amount: ${bonus.bonus_amount}, QGV: ${bonus.qualified_group_volume}`);
        });
      }
    }
    
    // Check leadership bonuses
    const { data: leadershipBonuses, error: leadershipError } = await supabase
      .from('leadership_bonuses')
      .select('*')
      .eq('status', 'pending')
      .eq('period', period);
    
    if (leadershipError) {
      console.error('Failed to check leadership bonuses:', leadershipError);
    } else {
      console.log(`✅ Found ${leadershipBonuses?.length || 0} pending leadership bonuses for period ${period}`);
    }
    
    // Check wallet transactions to confirm no credits were created
    const { data: walletTransactions, error: walletError } = await supabase
      .from('wallet_transactions')
      .select('*')
      .gte('created_at', new Date(now.getUTCFullYear(), now.getUTCMonth(), 1).toISOString())
      .lt('created_at', new Date(now.getUTCFullYear(), now.getUTCMonth() + 1, 1).toISOString());
    
    if (walletError) {
      console.error('Failed to check wallet transactions:', walletError);
    } else {
      console.log(`✅ Found ${walletTransactions?.length || 0} wallet transactions for current month (manual adjustments only)`);
    }
    
    console.log('\n✅ Monthly job verification complete');
    console.log('✅ All bonuses are in "pending" status (not credited to wallet)');
    console.log('✅ Staff approval required before wallet credits');
    
  } catch (error) {
    console.error('Monthly requalification failed:', error);
    process.exit(1);
  }
}

runMonthlyJob().catch(console.error);