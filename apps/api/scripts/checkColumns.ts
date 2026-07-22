import '../src/config/env.js';
import { supabase } from '../src/config/supabase.js';

async function check() {
  const { error } = await supabase
    .from('withdrawal_requests')
    .select('id, distributor_id, amount, method, payout_details, status, requested_at, reviewed_by, reviewed_at, notes')
    .limit(1);

  if (error) {
    console.log('Error selecting columns:', error.message);
  } else {
    console.log('All expected columns exist in withdrawal_requests!');
  }
}

check().catch(console.error);
