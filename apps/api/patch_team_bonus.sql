-- =========================================================
-- Step 14 Migration: Team Bonus Expansion (Multi-Level)
-- =========================================================

-- 1. Create team_bonus_rates table
-- Maps rank -> level -> percentage for team bonus calculations
CREATE TABLE IF NOT EXISTS team_bonus_rates (
    id          uuid primary key default uuid_generate_v4(),
    rank_id     uuid not null references ranks(id) on delete cascade,
    level       integer not null, -- 1 = direct downline, 2 = 2 levels down, etc.
    percentage  numeric(5,2) not null, -- e.g. 5.00 for 5%
    unique (rank_id, level)
);

CREATE INDEX IF NOT EXISTS idx_team_bonus_rates_rank ON team_bonus_rates(rank_id);

-- 2. Add bonus_type column to commissions if not exists
-- This distinguishes between 'referral_bonus', 'retail_profit', and 'team_bonus'
ALTER TABLE commissions ADD COLUMN IF NOT EXISTS bonus_type text;

-- Update existing commissions to have bonus_type = 'referral_bonus' for backward compatibility
UPDATE commissions SET bonus_type = 'referral_bonus' WHERE bonus_type IS NULL;

-- 3. Add source_distributor_id to track which distributor's sale generated the bonus
ALTER TABLE commissions ADD COLUMN IF NOT EXISTS source_distributor_id uuid references profiles(id);

-- =========================================================
-- Seed placeholder team bonus rates
-- ⚠️  IMPORTANT: These are placeholder values pending client confirmation.
-- Adjust percentages and level caps based on business agreement.
-- =========================================================

-- Get rank IDs
DO $$
DECLARE
    member_rank_id uuid;
    bronze_rank_id uuid;
    silver_rank_id uuid;
    gold_rank_id uuid;
    platinum_rank_id uuid;
    diamond_rank_id uuid;
BEGIN
    SELECT id INTO member_rank_id FROM ranks WHERE name = 'Member';
    SELECT id INTO bronze_rank_id FROM ranks WHERE name = 'Bronze';
    SELECT id INTO silver_rank_id FROM ranks WHERE name = 'Silver';
    SELECT id INTO gold_rank_id FROM ranks WHERE name = 'Gold';
    SELECT id INTO platinum_rank_id FROM ranks WHERE name = 'Platinum';
    SELECT id INTO diamond_rank_id FROM ranks WHERE name = 'Diamond';

    -- Member: 1 level only, 5%
    INSERT INTO team_bonus_rates (rank_id, level, percentage) VALUES
        (member_rank_id, 1, 5.00)
    ON CONFLICT (rank_id, level) DO NOTHING;

    -- Bronze: 2 levels, 5% + 3%
    INSERT INTO team_bonus_rates (rank_id, level, percentage) VALUES
        (bronze_rank_id, 1, 5.00),
        (bronze_rank_id, 2, 3.00)
    ON CONFLICT (rank_id, level) DO NOTHING;

    -- Silver: 3 levels, 5% + 3% + 2%
    INSERT INTO team_bonus_rates (rank_id, level, percentage) VALUES
        (silver_rank_id, 1, 5.00),
        (silver_rank_id, 2, 3.00),
        (silver_rank_id, 3, 2.00)
    ON CONFLICT (rank_id, level) DO NOTHING;

    -- Gold: 4 levels, 5% + 3% + 2% + 1%
    INSERT INTO team_bonus_rates (rank_id, level, percentage) VALUES
        (gold_rank_id, 1, 5.00),
        (gold_rank_id, 2, 3.00),
        (gold_rank_id, 3, 2.00),
        (gold_rank_id, 4, 1.00)
    ON CONFLICT (rank_id, level) DO NOTHING;

    -- Platinum: 5 levels, 5% + 3% + 2% + 1% + 0.5%
    INSERT INTO team_bonus_rates (rank_id, level, percentage) VALUES
        (platinum_rank_id, 1, 5.00),
        (platinum_rank_id, 2, 3.00),
        (platinum_rank_id, 3, 2.00),
        (platinum_rank_id, 4, 1.00),
        (platinum_rank_id, 5, 0.50)
    ON CONFLICT (rank_id, level) DO NOTHING;

    -- Diamond: 6 levels, 5% + 3% + 2% + 1% + 0.5% + 0.5%
    INSERT INTO team_bonus_rates (rank_id, level, percentage) VALUES
        (diamond_rank_id, 1, 5.00),
        (diamond_rank_id, 2, 3.00),
        (diamond_rank_id, 3, 2.00),
        (diamond_rank_id, 4, 1.00),
        (diamond_rank_id, 5, 0.50),
        (diamond_rank_id, 6, 0.50)
    ON CONFLICT (rank_id, level) DO NOTHING;
END $$;

-- 4. Enable RLS for team_bonus_rates
ALTER TABLE team_bonus_rates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "team_bonus_rates_authenticated_select" ON team_bonus_rates 
    FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "team_bonus_rates_staff_all" ON team_bonus_rates 
    FOR ALL USING (public.is_staff());
