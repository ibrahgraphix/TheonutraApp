-- =========================================================
-- Phase 1 Migration: Customer Sales & Retail Profit
-- Adds customer_sales, customer_sale_items tables and distributor_price
-- =========================================================

-- 1. Add distributor_price to product_prices
ALTER TABLE product_prices ADD COLUMN IF NOT EXISTS distributor_price numeric(12,2);

-- 2. Create customer_sales table
CREATE TABLE IF NOT EXISTS customer_sales (
    id              uuid primary key default uuid_generate_v4(),
    distributor_id  uuid not null references profiles(id),
    customer_name   text,
    customer_phone  text,
    country_id      uuid not null references countries(id),
    total_amount    numeric(12,2) not null,
    total_pv        numeric(12,2) not null default 0,
    created_at      timestamptz not null default now()
);

CREATE INDEX IF NOT EXISTS idx_customer_sales_distributor ON customer_sales(distributor_id);
CREATE INDEX IF NOT EXISTS idx_customer_sales_country ON customer_sales(country_id);

-- 3. Create customer_sale_items table
CREATE TABLE IF NOT EXISTS customer_sale_items (
    id                      uuid primary key default uuid_generate_v4(),
    customer_sale_id        uuid not null references customer_sales(id) on delete cascade,
    product_id              uuid not null references products(id),
    quantity                integer not null check (quantity > 0),
    unit_customer_price     numeric(12,2) not null,
    unit_distributor_price  numeric(12,2) not null,
    pv_at_sale              numeric(12,2) not null default 0
);

CREATE INDEX IF NOT EXISTS idx_customer_sale_items_sale ON customer_sale_items(customer_sale_id);

-- 4. Update commissions table to support retail_profit type
-- Add source_id and source_type columns if they don't exist
ALTER TABLE commissions ADD COLUMN IF NOT EXISTS source_id uuid;
ALTER TABLE commissions ADD COLUMN IF NOT EXISTS source_type text;

-- Update the sale_id to be nullable since retail_profit commissions don't have a sale_id
ALTER TABLE commissions ALTER COLUMN sale_id DROP NOT NULL;

-- 5. Enable RLS for new tables
ALTER TABLE customer_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_sale_items ENABLE ROW LEVEL SECURITY;

-- RLS policies for customer_sales
CREATE POLICY "customer_sales_self_select" ON customer_sales 
    FOR SELECT USING (auth.uid() = distributor_id);
CREATE POLICY "customer_sales_self_insert" ON customer_sales 
    FOR INSERT WITH CHECK (auth.uid() = distributor_id);
CREATE POLICY "customer_sales_staff_select" ON customer_sales 
    FOR SELECT USING (public.is_staff());

-- RLS policies for customer_sale_items
CREATE POLICY "customer_sale_items_owner_select" ON customer_sale_items
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM customer_sales cs 
            WHERE cs.id = customer_sale_id AND cs.distributor_id = auth.uid()
        )
    );
CREATE POLICY "customer_sale_items_staff_select" ON customer_sale_items
    FOR SELECT USING (public.is_staff());

-- 6. Add PV column to products table if not exists
ALTER TABLE products ADD COLUMN IF NOT EXISTS pv numeric(12,2) default 0;

-- 7. Create ranks table if not exists (for Step 12)
CREATE TABLE IF NOT EXISTS ranks (
    id                      uuid primary key default uuid_generate_v4(),
    name                    text not null unique,
    level_order             integer not null unique,
    personal_pv_required    numeric(12,2) not null default 0,
    team_pv_required        numeric(12,2) not null default 0,
    description            text,
    reward_description      text,
    created_at              timestamptz not null default now()
);

-- 8. Add rank_id to profiles if not exists
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS rank_id uuid references ranks(id);

-- 9. Create audit_logs table if not exists
CREATE TABLE IF NOT EXISTS audit_logs (
    id          uuid primary key default uuid_generate_v4(),
    action      text not null,
    actor_id    uuid references profiles(id),
    entity_type text not null,
    entity_id   uuid not null,
    metadata    jsonb,
    created_at  timestamptz not null default now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON audit_logs(actor_id);

-- Enable RLS for audit_logs
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit_logs_staff_select" ON audit_logs FOR SELECT USING (public.is_staff());
CREATE POLICY "audit_logs_staff_insert" ON audit_logs FOR INSERT WITH CHECK (public.is_staff());
