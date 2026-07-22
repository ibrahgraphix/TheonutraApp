import '../src/config/env.js';
import { supabase } from '../src/config/supabase.js';

async function main() {
  console.log('Fetching profiles...');
  const { data, error } = await supabase
    .from('profiles')
    .select('id, distributor_id, role, must_change_password');

  if (error) {
    console.error(error);
  } else {
    console.log(data);
  }
}

main().catch(console.error);
