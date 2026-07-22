/**
 * scripts/applyCustomerSalesMigration.ts
 * 
 * Applies the Phase 1 migration for customer sales and retail profit.
 * Run: tsx scripts/applyCustomerSalesMigration.ts
 */

import '../src/config/env.js';
import { supabase } from '../src/config/supabase.js';
import { readFileSync } from 'fs';
import { join } from 'path';

async function run() {
  console.log('🔄  Applying Phase 1 Migration: Customer Sales & Retail Profit\n');

  const sqlPath = join(process.cwd(), 'patch_customer_sales.sql');
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
      // Try direct query if rpc fails
      const { error: queryError } = await supabase.from('_').select('*');
      if (queryError) {
        console.log(`  ⚠️  RPC failed, trying direct query...`);
      }
    }
  }

  // Alternative: Use raw SQL via Postgres client
  // Since Supabase JS doesn't support raw SQL directly, we'll use a different approach
  console.log('\n⚠️  Supabase JS client does not support raw SQL execution directly.');
  console.log('Please run the SQL manually in your Supabase SQL Editor:');
  console.log(`   File: ${sqlPath}\n`);
  
  // Let's try to at least verify the tables exist
  console.log('🔍  Checking if customer_sales table exists...');
  const { data: tables, error } = await supabase
    .from('information_schema.tables')
    .select('table_name')
    .eq('table_schema', 'public')
    .eq('table_name', 'customer_sales');

  if (error) {
    console.log('  ❌  Cannot check table existence (RLS or permissions)');
    console.log('  Please run the SQL manually in Supabase SQL Editor');
  } else if (tables && tables.length > 0) {
    console.log('  ✅  customer_sales table exists');
  } else {
    console.log('  ❌  customer_sales table does not exist');
    console.log('  Please run the SQL manually in Supabase SQL Editor');
  }
}

run().catch((err) => {
  console.error('❌  Migration failed:', err.message ?? err);
  process.exit(1);
});
