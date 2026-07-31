/**
 * Migration script to add payment method columns to profiles table
 * Run this script to update the database schema
 */

import { supabase } from '../src/config/supabase.js';

async function addPaymentMethodColumns() {
  console.log('Adding payment method columns to profiles table...');

  try {
    // Add payment_method column
    const { error: methodError } = await supabase.rpc('add_column_if_not_exists', {
      table_name: 'profiles',
      column_name: 'payment_method',
      column_type: 'text'
    });

    if (methodError) {
      console.error('Error adding payment_method column:', methodError);
    } else {
      console.log('✅ Added payment_method column');
    }

    // Add payment_full_name column
    const { error: nameError } = await supabase.rpc('add_column_if_not_exists', {
      table_name: 'profiles',
      column_name: 'payment_full_name',
      column_type: 'text'
    });

    if (nameError) {
      console.error('Error adding payment_full_name column:', nameError);
    } else {
      console.log('✅ Added payment_full_name column');
    }

    // Add payment_account_number column
    const { error: accountError } = await supabase.rpc('add_column_if_not_exists', {
      table_name: 'profiles',
      column_name: 'payment_account_number',
      column_type: 'text'
    });

    if (accountError) {
      console.error('Error adding payment_account_number column:', accountError);
    } else {
      console.log('✅ Added payment_account_number column');
    }

    console.log('Migration completed successfully');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

// Alternative approach using raw SQL if RPC is not available
async function addPaymentMethodColumnsSQL() {
  console.log('Adding payment method columns using raw SQL...');

  const sqlStatements = [
    `ALTER TABLE profiles ADD COLUMN IF NOT EXISTS payment_method text;`,
    `ALTER TABLE profiles ADD COLUMN IF NOT EXISTS payment_full_name text;`,
    `ALTER TABLE profiles ADD COLUMN IF NOT EXISTS payment_account_number text;`
  ];

  for (const sql of sqlStatements) {
    try {
      const { error } = await supabase.rpc('exec_sql', { sql });
      if (error) {
        console.error('Error executing SQL:', error);
      } else {
        console.log('✅ Executed:', sql);
      }
    } catch (e) {
      console.error('SQL execution failed:', e);
    }
  }

  console.log('Migration completed');
}

// Run the migration
addPaymentMethodColumns().catch(console.error);