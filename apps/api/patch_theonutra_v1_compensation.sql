-- =========================================================
-- THEONUTRA V1 Compensation Engine + Step 26 schema
-- Run in Supabase SQL Editor. Idempotent.
-- =========================================================

-- 1. Star ranks (Star 1 … Lead Star 7)
CREATE TABLE IF NOT EXISTS star_ranks (
  id             uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  code           text NOT NULL UNIQUE,
  name           text NOT NULL,
  level_order    integer NOT NULL UNIQUE,
  min_ppv        numeric(12,2) NOT NULL DEFAULT 0,
  min_cgv        numeric(12,2) NOT NULL DEFAULT 0,
  bonus_percent  numeric(5,2) NOT NULL DEFAULT 0,
  created_at     timestamptz NOT NULL DEFAULT now()
);

INSERT INTO star_ranks (code, name, level_order, min_ppv, min_cgv, bonus_percent) VALUES
  ('STAR_1', 'Star 1', 1, 10, 0, 2),
  ('STAR_2', 'Star 2', 2, 20, 200, 5),
  ('STAR_3', 'Star 3', 3, 30, 400, 9),
  ('STAR_4', 'Star 4', 4, 30, 1000, 13),
  ('STAR_5', 'Star 5', 5, 40, 5000, 17),
  ('STAR_6', 'Star 6', 6, 40, 8000, 22),
  ('LEAD_STAR_7', 'Lead Star 7', 7, 50, 12000, 28)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  level_order = EXCLUDED.level_order,
  min_ppv = EXCLUDED.min_ppv,
  min_cgv = EXCLUDED.min_cgv,
  bonus_percent = EXCLUDED.bonus_percent;

-- 2. Compensation settings (singleton)
CREATE TABLE IF NOT EXISTS compensation_settings (
  id           int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  usd_per_pv   numeric(12,4) NOT NULL DEFAULT 1.0000,
  usd_tzs_rate numeric(12,4) NOT NULL DEFAULT 2500.0000,
  updated_at   timestamptz NOT NULL DEFAULT now()
);
INSERT INTO compensation_settings (id, usd_per_pv, usd_tzs_rate)
VALUES (1, 1.0000, 2500.0000)
ON CONFLICT (id) DO NOTHING;

-- 3. Profile columns for V1 + passport photo
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS star_rank_id uuid REFERENCES star_ranks(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS placement_sponsor_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS leg_position text CHECK (leg_position IS NULL OR leg_position IN ('left', 'center', 'right')),
  ADD COLUMN IF NOT EXISTS lifetime_cgv numeric(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS photo_url text,
  ADD COLUMN IF NOT EXISTS payment_method text,
  ADD COLUMN IF NOT EXISTS payment_full_name text,
  ADD COLUMN IF NOT EXISTS payment_account_number text;

CREATE INDEX IF NOT EXISTS idx_profiles_placement_sponsor ON profiles(placement_sponsor_id);
CREATE INDEX IF NOT EXISTS idx_profiles_star_rank ON profiles(star_rank_id);

-- Default new distributors to Star 1 if unset
UPDATE profiles p
SET star_rank_id = (SELECT id FROM star_ranks WHERE code = 'STAR_1' LIMIT 1)
WHERE p.role = 'distributor' AND p.star_rank_id IS NULL;

-- Backfill placement from referred_by where missing
UPDATE profiles
SET placement_sponsor_id = referred_by
WHERE placement_sponsor_id IS NULL AND referred_by IS NOT NULL;

-- 4. Placement-based downline tree (falls back to referred_by)
CREATE OR REPLACE VIEW downline_tree AS
WITH RECURSIVE tree AS (
  SELECT
    id AS root_id,
    id AS member_id,
    full_name,
    distributor_id,
    COALESCE(placement_sponsor_id, referred_by) AS referred_by,
    0 AS level
  FROM profiles

  UNION ALL

  SELECT
    tree.root_id,
    p.id AS member_id,
    p.full_name,
    p.distributor_id,
    COALESCE(p.placement_sponsor_id, p.referred_by) AS referred_by,
    tree.level + 1
  FROM profiles p
  INNER JOIN tree ON COALESCE(p.placement_sponsor_id, p.referred_by) = tree.member_id
)
SELECT * FROM tree WHERE level > 0;

-- 5. Monthly volume cache
CREATE TABLE IF NOT EXISTS distributor_volume_monthly (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  distributor_id  uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  period          text NOT NULL, -- YYYY-MM
  ppv             numeric(14,2) NOT NULL DEFAULT 0,
  gpv             numeric(14,2) NOT NULL DEFAULT 0,
  is_active       boolean NOT NULL DEFAULT false,
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (distributor_id, period)
);
CREATE INDEX IF NOT EXISTS idx_dvm_period ON distributor_volume_monthly(period);

-- 6. Network bonuses (Active Monthly + Differential)
CREATE TABLE IF NOT EXISTS network_bonuses (
  id                uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  distributor_id    uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  source_distributor_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  bonus_type        text NOT NULL CHECK (bonus_type IN ('active_monthly', 'differential')),
  period            text NOT NULL,
  bonus_pv          numeric(14,4) NOT NULL DEFAULT 0,
  bonus_usd         numeric(14,4) NOT NULL DEFAULT 0,
  exchange_rate     numeric(14,4) NOT NULL DEFAULT 0,
  amount_tzs        numeric(14,2) NOT NULL DEFAULT 0,
  status            text NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending', 'approved', 'rejected', 'paid')),
  approved_by       uuid REFERENCES profiles(id) ON DELETE SET NULL,
  approved_at       timestamptz,
  paid_at           timestamptz,
  notes             text,
  created_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_network_bonuses_status ON network_bonuses(status);
CREATE INDEX IF NOT EXISTS idx_network_bonuses_dist ON network_bonuses(distributor_id);
CREATE INDEX IF NOT EXISTS idx_network_bonuses_period ON network_bonuses(period);

-- 7. Payment method change requests (Step 26 E)
CREATE TABLE IF NOT EXISTS payment_method_change_requests (
  id                      uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  distributor_id          uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  old_payment_method      text,
  old_payment_full_name   text,
  old_payment_account_number text,
  new_payment_method      text NOT NULL,
  new_payment_full_name   text NOT NULL,
  new_payment_account_number text NOT NULL,
  status                  text NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by             uuid REFERENCES profiles(id) ON DELETE SET NULL,
  reviewed_at             timestamptz,
  notes                   text,
  created_at              timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pmcr_status ON payment_method_change_requests(status);
CREATE INDEX IF NOT EXISTS idx_pmcr_distributor ON payment_method_change_requests(distributor_id);

-- 8. Monthly payout batch log
CREATE TABLE IF NOT EXISTS payout_batches (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  period       text NOT NULL,
  run_by       uuid REFERENCES profiles(id) ON DELETE SET NULL,
  paid_count   integer NOT NULL DEFAULT 0,
  total_tzs    numeric(14,2) NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- Verification
SELECT code, name, min_ppv, min_cgv, bonus_percent FROM star_ranks ORDER BY level_order;
SELECT column_name FROM information_schema.columns
WHERE table_name = 'profiles'
  AND column_name IN ('star_rank_id','placement_sponsor_id','leg_position','lifetime_cgv','photo_url')
ORDER BY column_name;
