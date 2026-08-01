-- =========================================================
-- Complete Schema Fix Migration
-- Run this in Supabase SQL Editor to fix all schema issues
-- =========================================================

-- =========================================================
-- PART 1: Fix commissions table
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

-- =========================================================
-- PART 2: Fix withdrawal_requests table
-- =========================================================

-- Drop the existing check constraint on status
ALTER TABLE withdrawal_requests 
DROP CONSTRAINT IF EXISTS withdrawal_requests_status_check;

-- Re-add the check constraint with additional statuses
ALTER TABLE withdrawal_requests 
ADD CONSTRAINT withdrawal_requests_status_check 
CHECK (status IN ('pending', 'approved', 'rejected', 'paid', 'failed', 'cancelled'));

-- =========================================================
-- PART 3: Add RPC functions for failed and cancelled withdrawals
-- =========================================================

-- RPC: fail_withdrawal (status → failed, refund reserved amount)
CREATE OR REPLACE FUNCTION public.fail_withdrawal(
  p_request_id  uuid,
  p_reviewed_by uuid,
  p_notes       text
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_distributor_id uuid;
  v_amount         numeric;
  v_status         text;
BEGIN
  SELECT distributor_id, amount, status
  INTO   v_distributor_id, v_amount, v_status
  FROM   public.withdrawal_requests WHERE id = p_request_id FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Withdrawal request not found'; END IF;
  IF v_status <> 'pending' THEN RAISE EXCEPTION 'Withdrawal request is not pending'; END IF;

  UPDATE public.withdrawal_requests
  SET status = 'failed', reviewed_by = p_reviewed_by, reviewed_at = now(), notes = p_notes
  WHERE id = p_request_id;

  -- Refund the amount back to wallet
  UPDATE public.wallets
  SET balance = balance + v_amount, updated_at = now()
  WHERE distributor_id = v_distributor_id;
END;
$$;

-- RPC: cancel_withdrawal (status → cancelled, refund reserved amount)
CREATE OR REPLACE FUNCTION public.cancel_withdrawal(
  p_request_id  uuid,
  p_reviewed_by uuid
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_distributor_id uuid;
  v_amount         numeric;
  v_status         text;
BEGIN
  SELECT distributor_id, amount, status
  INTO   v_distributor_id, v_amount, v_status
  FROM   public.withdrawal_requests WHERE id = p_request_id FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Withdrawal request not found'; END IF;
  IF v_status <> 'pending' THEN RAISE EXCEPTION 'Withdrawal request is not pending'; END IF;

  UPDATE public.withdrawal_requests
  SET status = 'cancelled', reviewed_by = p_reviewed_by, reviewed_at = now()
  WHERE id = p_request_id;

  -- Refund the amount back to wallet
  UPDATE public.wallets
  SET balance = balance + v_amount, updated_at = now()
  WHERE distributor_id = v_distributor_id;
END;
$$;

-- =========================================================
-- Verification Queries
-- =========================================================

-- Check commissions table structure
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'commissions' 
ORDER BY ordinal_position;

-- Check withdrawal_requests constraint
SELECT conname AS constraint_name, pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint 
WHERE conrelid = 'withdrawal_requests'::regclass AND conname LIKE '%status%';

-- Check if RPC functions exist
SELECT routine_name, routine_type 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name IN ('fail_withdrawal', 'cancel_withdrawal');
