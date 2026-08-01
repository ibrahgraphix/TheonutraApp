-- =========================================================
-- Patch: Add missing columns to commissions table
-- Run this in Supabase SQL Editor (Project → SQL Editor → New query)
-- Idempotent — safe to re-run.
-- =========================================================

-- Add status column with default 'pending'
ALTER TABLE commissions
ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending';

-- Drop/re-add check so re-runs don't fail if constraint already exists under another name
ALTER TABLE commissions DROP CONSTRAINT IF EXISTS commissions_status_check;
ALTER TABLE commissions
ADD CONSTRAINT commissions_status_check
CHECK (status IN ('pending', 'approved', 'rejected'));

-- Add bonus_type column to distinguish between referral and team bonuses
ALTER TABLE commissions
ADD COLUMN IF NOT EXISTS bonus_type text NOT NULL DEFAULT 'referral';

ALTER TABLE commissions DROP CONSTRAINT IF EXISTS commissions_bonus_type_check;
ALTER TABLE commissions
ADD CONSTRAINT commissions_bonus_type_check
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

-- Backfill existing rows
UPDATE commissions
SET status = COALESCE(status, 'pending'),
    bonus_type = COALESCE(bonus_type, 'referral')
WHERE status IS NULL OR bonus_type IS NULL;

-- =========================================================
-- Disable auto-credit on insert
-- Wallet credit now happens only when staff approves a commission
-- (see approveCommission in compensationPlan.service.ts).
-- Leaving this trigger would double-credit on approve.
-- =========================================================
DROP TRIGGER IF EXISTS trg_commissions_on_insert ON public.commissions;

-- Verification
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'commissions'
ORDER BY ordinal_position;
