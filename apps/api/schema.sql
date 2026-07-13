-- =========================================================
-- DISTRIBUTOR / NETWORK MARKETING APP — DATABASE SCHEMA
-- Target: Supabase (Postgres + auth.users)
-- =========================================================

-- ---------------------------------------------------------
-- 1. EXTENSIONS
-- ---------------------------------------------------------
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ---------------------------------------------------------
-- 2. ROLES (role-based access: distributor vs company staff)
-- ---------------------------------------------------------
create type user_role as enum ('distributor', 'admin', 'company_staff');

-- ---------------------------------------------------------
-- 3. COUNTRIES (drives country-based catalog & pricing)
-- ---------------------------------------------------------
create table countries (
    id            uuid primary key default uuid_generate_v4(),
    name          text not null unique,           -- e.g. 'Tanzania'
    iso_code      text not null unique,            -- e.g. 'TZ'
    currency_code text not null,                   -- e.g. 'TZS'
    is_active     boolean not null default true,
    created_at    timestamptz not null default now()
);

-- ---------------------------------------------------------
-- 4. PROFILES (extends auth.users)
--    - distributor_id is the human-facing login ID
--    - referred_by references the recruiter (adjacency list = simplest downline model)
-- ---------------------------------------------------------
create table profiles (
    id             uuid primary key references auth.users(id) on delete cascade,
    distributor_id text not null unique,           -- e.g. 'BF-TZ-00231'
    full_name      text not null,
    phone_number   text not null,
    role           user_role not null default 'distributor',
    country_id     uuid not null references countries(id),
    referred_by    uuid references profiles(id) on delete set null,
    is_active      boolean not null default true,
    must_change_password boolean not null default true,  -- forces reset on first login after company issues a temp password
    created_by     uuid references profiles(id),          -- which staff member created this account
    created_at     timestamptz not null default now(),
    updated_at     timestamptz not null default now()
);

create index idx_profiles_referred_by on profiles(referred_by);
create index idx_profiles_country on profiles(country_id);
create index idx_profiles_distributor_id on profiles(distributor_id);

-- Auto-update updated_at
create or replace function set_updated_at()
returns trigger as $$
begin
    new.updated_at = now();
    return new;
end;
$$ language plpgsql;

create trigger trg_profiles_updated_at
before update on profiles
for each row execute function set_updated_at();

-- ---------------------------------------------------------
-- 5. DOWNLINE TREE — recursive view (no separate table needed)
--    Walks the referred_by chain to build each distributor's full team
-- ---------------------------------------------------------
create or replace view downline_tree as
with recursive tree as (
    select
        id as root_id,
        id as member_id,
        full_name,
        distributor_id,
        referred_by,
        0 as level
    from profiles

    union all

    select
        tree.root_id,
        p.id as member_id,
        p.full_name,
        p.distributor_id,
        p.referred_by,
        tree.level + 1
    from profiles p
    inner join tree on p.referred_by = tree.member_id
)
select * from tree where level > 0;

-- Usage: select * from downline_tree where root_id = '<distributor uuid>';
-- Returns every person recruited directly or indirectly, with their depth level.

-- ---------------------------------------------------------
-- 6. PRODUCTS
-- ---------------------------------------------------------
create table products (
    id           uuid primary key default uuid_generate_v4(),
    name         text not null,
    description  text,
    image_url    text,                     -- Cloudinary URL
    is_active    boolean not null default true,
    created_by   uuid references profiles(id),  -- admin who added it
    created_at   timestamptz not null default now(),
    updated_at   timestamptz not null default now()
);

create trigger trg_products_updated_at
before update on products
for each row execute function set_updated_at();

-- ---------------------------------------------------------
-- 7. PRODUCT PRICES (country-based pricing)
--    A product can have a different price per country/currency,
--    and can be marked unavailable in a given country.
-- ---------------------------------------------------------
create table product_prices (
    id           uuid primary key default uuid_generate_v4(),
    product_id   uuid not null references products(id) on delete cascade,
    country_id   uuid not null references countries(id) on delete cascade,
    price        numeric(12,2) not null,
    is_available boolean not null default true,
    unique (product_id, country_id)
);

create index idx_product_prices_country on product_prices(country_id);

-- Usage: to show the TZ catalog —
-- select p.*, pp.price
-- from products p
-- join product_prices pp on pp.product_id = p.id
-- where pp.country_id = '<tanzania uuid>' and pp.is_available = true;

-- ---------------------------------------------------------
-- 8. ORDERS & PAYMENTS (bank payment assumed for now)
-- ---------------------------------------------------------
create type order_status as enum ('pending', 'paid', 'cancelled', 'refunded');
create type payment_method as enum ('bank_transfer', 'mobile_money', 'card');

create table orders (
    id           uuid primary key default uuid_generate_v4(),
    buyer_id     uuid not null references profiles(id),
    country_id   uuid not null references countries(id),
    status       order_status not null default 'pending',
    total_amount numeric(12,2) not null,
    currency_code text not null,
    created_at   timestamptz not null default now(),
    updated_at   timestamptz not null default now()
);

create trigger trg_orders_updated_at
before update on orders
for each row execute function set_updated_at();

create table order_items (
    id          uuid primary key default uuid_generate_v4(),
    order_id    uuid not null references orders(id) on delete cascade,
    product_id  uuid not null references products(id),
    quantity    integer not null check (quantity > 0),
    unit_price  numeric(12,2) not null,   -- snapshot of price at purchase time
    subtotal    numeric(12,2) generated always as (quantity * unit_price) stored
);

create index idx_order_items_order on order_items(order_id);

create table payments (
    id             uuid primary key default uuid_generate_v4(),
    order_id       uuid not null references orders(id) on delete cascade,
    method         payment_method not null default 'bank_transfer',
    reference_no   text,                  -- bank transaction reference / slip number
    provider       text,                  -- mobile money provider (mpesa/tigopesa/airtelmoney)
    phone_number   text,                  -- mobile money payer phone number
    amount         numeric(12,2) not null,
    is_confirmed   boolean not null default false,   -- admin confirms bank deposit manually
    confirmed_by   uuid references profiles(id),
    confirmed_at   timestamptz,
    created_at     timestamptz not null default now()
);

create index idx_payments_order on payments(order_id);

-- ---------------------------------------------------------
-- 9. SALES & COMMISSIONS (bonus tracking)
--    A "sale" is created whenever an order is confirmed paid.
--    Commission entries pay out the buyer's upline based on level.
-- ---------------------------------------------------------
create table sales (
    id           uuid primary key default uuid_generate_v4(),
    order_id     uuid not null unique references orders(id),
    distributor_id uuid not null references profiles(id),  -- who made the sale
    amount       numeric(12,2) not null,
    sale_date    date not null default current_date,
    created_at   timestamptz not null default now()
);

create index idx_sales_distributor on sales(distributor_id);
create index idx_sales_date on sales(sale_date);

create table commissions (
    id             uuid primary key default uuid_generate_v4(),
    sale_id        uuid not null references sales(id) on delete cascade,
    beneficiary_id uuid not null references profiles(id),  -- upline member earning the bonus
    level          integer not null,                       -- how many levels up from the sale
    amount         numeric(12,2) not null,
    created_at     timestamptz not null default now()
);

create index idx_commissions_beneficiary on commissions(beneficiary_id);

-- ---------------------------------------------------------
-- 10. MONTHLY ANALYSIS — views for the "my sales / my team / my bonus this month" screen
-- ---------------------------------------------------------
create or replace view monthly_personal_sales as
select
    distributor_id,
    date_trunc('month', sale_date) as month,
    sum(amount) as total_sales,
    count(*) as total_orders
from sales
group by distributor_id, date_trunc('month', sale_date);

create or replace view monthly_team_sales as
select
    dt.root_id as distributor_id,
    date_trunc('month', s.sale_date) as month,
    sum(s.amount) as team_total_sales
from downline_tree dt
join sales s on s.distributor_id = dt.member_id
group by dt.root_id, date_trunc('month', s.sale_date);

create or replace view monthly_bonus as
select
    beneficiary_id as distributor_id,
    date_trunc('month', created_at) as month,
    sum(amount) as total_bonus
from commissions
group by beneficiary_id, date_trunc('month', created_at);

-- ---------------------------------------------------------
-- 11. ARTICLES & NEWS (company can post; distributors read)
-- ---------------------------------------------------------
create table articles (
    id          uuid primary key default uuid_generate_v4(),
    title       text not null,
    body        text not null,
    cover_image_url text,       -- Cloudinary
    author_id   uuid references profiles(id),
    is_published boolean not null default true,
    created_at  timestamptz not null default now()
);

create table news (
    id          uuid primary key default uuid_generate_v4(),
    title       text not null,
    body        text not null,
    cover_image_url text,
    author_id   uuid references profiles(id),  -- must be admin/company_staff
    is_published boolean not null default true,
    created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------
-- 12. ROW LEVEL SECURITY
-- ---------------------------------------------------------

-- Helper function: checks if the current user is staff, WITHOUT re-triggering
-- RLS on profiles (SECURITY DEFINER bypasses RLS inside this function only).
create or replace function public.is_staff()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
    select exists (
        select 1 from profiles
        where id = auth.uid() and role in ('admin', 'company_staff')
    );
$$;

alter table profiles enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;
alter table payments enable row level security;
alter table sales enable row level security;
alter table commissions enable row level security;
alter table products enable row level security;
alter table product_prices enable row level security;
alter table countries enable row level security;
alter table articles enable row level security;
alter table news enable row level security;

-- PROFILES
create policy "profiles_self_select" on profiles for select using (auth.uid() = id);
create policy "profiles_self_update" on profiles for update using (auth.uid() = id);
create policy "profiles_staff_select" on profiles for select using ( public.is_staff() );
create policy "profiles_staff_insert" on profiles for insert with check ( public.is_staff() );
create policy "profiles_staff_update" on profiles for update using ( public.is_staff() );

-- ORDERS
create policy "orders_self_select" on orders for select using (auth.uid() = buyer_id);
create policy "orders_self_insert" on orders for insert with check (auth.uid() = buyer_id);
create policy "orders_staff_select" on orders for select using ( public.is_staff() );

-- ORDER ITEMS
create policy "order_items_owner_select" on order_items
    for select using (
        exists (select 1 from orders o where o.id = order_id and o.buyer_id = auth.uid())
    );
create policy "order_items_staff_select" on order_items for select using ( public.is_staff() );

-- PAYMENTS
create policy "payments_owner_select" on payments
    for select using (
        exists (select 1 from orders o where o.id = order_id and o.buyer_id = auth.uid())
    );
create policy "payments_owner_insert" on payments
    for insert with check (
        exists (select 1 from orders o where o.id = order_id and o.buyer_id = auth.uid())
    );
create policy "payments_staff_all" on payments for all using ( public.is_staff() );

-- SALES
create policy "sales_self_select" on sales for select using (auth.uid() = distributor_id);
create policy "sales_staff_select" on sales for select using ( public.is_staff() );

-- COMMISSIONS
create policy "commissions_self_select" on commissions for select using (auth.uid() = beneficiary_id);
create policy "commissions_staff_select" on commissions for select using ( public.is_staff() );

-- PRODUCTS, PRICES, COUNTRIES
create policy "products_authenticated_select" on products for select using (auth.role() = 'authenticated');
create policy "products_staff_write" on products for all using ( public.is_staff() );
create policy "product_prices_authenticated_select" on product_prices for select using (auth.role() = 'authenticated');
create policy "product_prices_staff_write" on product_prices for all using ( public.is_staff() );
create policy "countries_authenticated_select" on countries for select using (auth.role() = 'authenticated');
create policy "countries_staff_write" on countries for all using ( public.is_staff() );

-- ARTICLES & NEWS
create policy "articles_authenticated_select" on articles for select using (auth.role() = 'authenticated');
create policy "articles_staff_write" on articles for all using ( public.is_staff() );
create policy "news_authenticated_select" on news for select using (auth.role() = 'authenticated');
create policy "news_staff_write" on news for all using ( public.is_staff() );
