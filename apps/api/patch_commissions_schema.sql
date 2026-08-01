-- =========================================================
-- Patch: Add missing columns to commissions table
-- =========================================================

-- Add status column with default 'pending'
ALTER TABLE commissions 
ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending' 
CHECK (status IN ('pending', 'approved', 'rejected'));

-- Add bonus_type column to distinguish between referral and team bonuses
ALTER TABLE commissions 
ADD COLUMN IF NOT EXISTS bonus_type text NOT NULL DEFAULT 'referral' 
CHECK (bonus_type IN ('referral', 'team_bonus', 'opb', 'leadership', 'rank'));

-- Add approved_by column (references profiles table)
ALTER TABLE commissions 
ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES profiles(id) ON DELETE SET NULL;

-- Add approved_at timestamp
ALTER TABLE commissions 
ADD COLUMN IF NOT EXISTS approved_at timestamptz;

-- Add source_distributor_id for team bonuses (who in the downline generated the bonus)
ALTER TABLE commissions 
ADD COLUMN IF NOT EXISTS source_distributor_id uuid REFERENCES profiles(id) ON DELETE SET NULL;

-- Create index on status for faster pending queries
CREATE INDEX IF NOT EXISTS idx_commissions_status ON commissions(status);

-- Create index on bonus_type for filtering by bonus type
CREATE INDEX IF NOT EXISTS idx_commissions_bonus_type ON commissions(bonus_type);

-- Update existing commissions to have default values
UPDATE commissions 
SET status = 'pending', 
    bonus_type = 'referral' 
WHERE status IS NULL OR bonus_type IS NULL;
