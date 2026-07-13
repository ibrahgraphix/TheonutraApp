import '../src/config/env.js';
import { supabase } from '../src/config/supabase.js';

async function check() {
  const { error } = await supabase
    .from('payments')
    .select('provider, phone_number')
    .limit(1);

  if (error) {
    console.log('Error selecting provider and phone_number:', error.message);
  } else {
    console.log('Success! provider and phone_number columns exist.');
  }
}

check().catch(console.error);
