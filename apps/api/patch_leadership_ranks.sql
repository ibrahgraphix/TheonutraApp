-- =========================================================
-- THEONUTRA Leadership Ranks Schema (Official Specification)
-- Run in Supabase SQL Editor. Idempotent.
-- =========================================================

-- 1. Drop existing leadership_ranks table if it exists with different schema
DROP TABLE IF EXISTS leadership_ranks CASCADE;

-- 2. Leadership Ranks Table (Dynamic - Monthly Requalification)
CREATE TABLE leadership_ranks (
  id                    uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  code                  text NOT NULL UNIQUE,
  name                  text NOT NULL,
  level_order           integer NOT NULL UNIQUE,
  min_ppv               numeric(12,2) NOT NULL DEFAULT 0,
  min_yearly_gpv        numeric(14,2) NOT NULL DEFAULT 0,
  required_leaders      integer NOT NULL DEFAULT 0,
  leadership_bonus_pct  numeric(5,2) NOT NULL DEFAULT 0,
  created_at            timestamptz NOT NULL DEFAULT now()
);

-- Insert official leadership ranks per specification
INSERT INTO leadership_ranks (code, name, level_order, min_ppv, min_yearly_gpv, required_leaders, leadership_bonus_pct) VALUES
  ('SL', 'Senior Leader', 1, 100, 40000, 1, 5),
  ('DL', 'Diamond Leader', 2, 100, 80000, 2, 5),
  ('SDL', 'Senior Diamond Leader', 3, 200, 120000, 3, 5);

-- 3. Add leadership_rank_id to profiles if not exists
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS leadership_rank_id uuid REFERENCES leadership_ranks(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_leadership_rank ON profiles(leadership_rank_id);

-- 4. Create leadership bonuses table for override bonuses
CREATE TABLE IF NOT EXISTS leadership_bonuses (
  id                  uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  distributor_id      uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  leadership_rank_id   uuid NOT NULL REFERENCES leadership_ranks(id) ON DELETE CASCADE,
  period              text NOT NULL, -- YYYY-MM
  qualified_legs_count integer NOT NULL DEFAULT 0,
  bonus_pv            numeric(14,4) NOT NULL DEFAULT 0,
  bonus_usd           numeric(14,4) NOT NULL DEFAULT 0,
  exchange_rate       numeric(14,4) NOT NULL DEFAULT 0,
  amount_tzs          numeric(14,2) NOT NULL DEFAULT 0,
  status              text NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending', 'approved', 'rejected', 'paid')),
  approved_by         uuid REFERENCES profiles(id) ON DELETE SET NULL,
  approved_at         timestamptz,
  paid_at             timestamptz,
  notes               text,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_leadership_bonuses_status ON leadership_bonuses(status);
CREATE INDEX IF NOT EXISTS idx_leadership_bonuses_dist ON leadership_bonuses(distributor_id);
CREATE INDEX IF NOT EXISTS idx_leadership_bonuses_period ON leadership_bonuses(period);

-- 5. Yearly GPV tracking table for leadership qualification
CREATE TABLE IF NOT EXISTS distributor_yearly_gpv (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  distributor_id  uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  year            integer NOT NULL, -- YYYY
  total_gpv       numeric(14,2) NOT NULL DEFAULT 0,
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (distributor_id, year)
);

CREATE INDEX IF NOT EXISTS idx_dyg_year ON distributor_yearly_gpv(year);
CREATE INDEX IF NOT EXISTS idx_dyg_distributor ON distributor_yearly_gpv(distributor_id);

-- Verification
SELECT code, name, min_ppv, min_yearly_gpv, required_leaders, leadership_bonus_pct FROM leadership_ranks ORDER BY level_order;
SELECT column_name FROM information_schema.columns
WHERE table_name = 'profiles'
  AND column_name = 'leadership_rank_id';
