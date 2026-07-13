-- ================================================================
-- Patch: Add missing columns to profiles table
-- Run this in: Supabase Dashboard → SQL Editor
--
-- Why: schema.sql was partially applied — the profiles table exists
-- but some columns are missing. This adds them safely (IF NOT EXISTS
-- means it's safe to re-run even if some already exist).
-- ================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS created_by           uuid    REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS is_active            boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS referred_by          uuid    REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_at           timestamptz NOT NULL DEFAULT now();

-- Re-create the updated_at trigger in case it also didn't apply
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Re-create indexes in case they also didn't apply
CREATE INDEX IF NOT EXISTS idx_profiles_referred_by    ON public.profiles(referred_by);
CREATE INDEX IF NOT EXISTS idx_profiles_country        ON public.profiles(country_id);
CREATE INDEX IF NOT EXISTS idx_profiles_distributor_id ON public.profiles(distributor_id);
