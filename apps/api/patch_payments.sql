-- ================================================================
-- Patch: Add mobile money columns to payments table
-- Run this in: Supabase Dashboard → SQL Editor
--
-- Why: payments table needs provider and phone_number for mobile money
-- ================================================================

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS provider     text,
  ADD COLUMN IF NOT EXISTS phone_number text;
