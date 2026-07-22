import '../src/config/env.js';
import { supabase } from '../src/config/supabase.js';
import { readFileSync } from 'fs';
import { join } from 'path';

async function run() {
  console.log('🔄  Applying Step 15 Migration: Wallet + Withdrawals\n');

  const sqlPath = join(process.cwd(), 'patch_wallet.sql');
  const sql = readFileSync(sqlPath, 'utf-8');

  // Split by semicolon and execute each statement
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i];
    console.log(`Executing statement ${i + 1}/${statements.length}...`);
    
    const { error } = await supabase.rpc('exec_sql', { sql: stmt });
    
    if (error) {
      console.error(`  ❌ Failed executing statement: ${stmt.slice(0, 50)}...`);
      console.error(`  Error: ${error.message} (${error.code})`);
      process.exit(1);
    }
  }

  console.log('\n✅  Migration applied successfully!');
}

run().catch((err) => {
  console.error('❌  Migration failed:', err.message ?? err);
  process.exit(1);
});
