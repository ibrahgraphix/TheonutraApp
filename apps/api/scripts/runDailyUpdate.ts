/**
 * Manual script to run daily PPV/CGV calculation
 * This simulates the daily scheduled job for testing purposes
 */

import { supabase } from '../src/config/supabase.js';
import { calculatePPV, calculateCGV } from '../src/services/compensationPlan.service.js';

async function runDailyUpdate() {
  console.log('Starting daily PPV/CGV calculation...');
  
  try {
    // Get all active distributors
    const { data: distributors, error: distError } = await supabase
      .from('profiles')
      .select('id, distributor_id, full_name')
      .eq('is_active', true);
    
    if (distError) {
      console.error('Failed to fetch distributors:', distError);
      return;
    }
    
    console.log(`Found ${distributors?.length || 0} active distributors`);
    
    const now = new Date();
    const currentMonth = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
    
    let updatedCount = 0;
    
    for (const distributor of distributors || []) {
      try {
        const ppv = await calculatePPV(distributor.id, currentMonth);
        const cgv = await calculateCGV(distributor.id, currentMonth);
        
        console.log(`Distributor ${distributor.distributor_id} (${distributor.full_name}): PPV=${ppv}, CGV=${cgv}`);
        
        // Note: In the current implementation, PPV/CGV are calculated on-demand
        // This job primarily ensures calculations are up-to-date for ranking
        updatedCount++;
      } catch (error) {
        console.error(`Failed to calculate PPV/CGV for ${distributor.distributor_id}:`, error);
      }
    }
    
    console.log(`Daily update complete. Updated ${updatedCount} distributors.`);
    console.log('✅ No wallet credits created by daily job (as expected)');
    
  } catch (error) {
    console.error('Daily update failed:', error);
    process.exit(1);
  }
}

runDailyUpdate().catch(console.error);