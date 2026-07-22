-- Add country_id to customer_sales table (needed for product price lookup)
ALTER TABLE customer_sales ADD COLUMN IF NOT EXISTS country_id uuid references countries(id);

-- Add source_id and source_type to commissions table (for retail_profit tracking)
ALTER TABLE commissions ADD COLUMN IF NOT EXISTS source_id uuid;
ALTER TABLE commissions ADD COLUMN IF NOT EXISTS source_type text;

-- Make sale_id nullable in commissions (retail_profit commissions don't have a sale_id)
ALTER TABLE commissions ALTER COLUMN sale_id DROP NOT NULL;
