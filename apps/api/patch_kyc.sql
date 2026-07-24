-- =========================================================
-- Step 17 Migration: KYC (Manual Review)
-- =========================================================

-- 1. Create kyc_status enum type
CREATE TYPE kyc_status_enum AS ENUM ('not_submitted', 'pending', 'approved', 'rejected', 'resubmit_required');

-- 2. Add kyc_status column to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS kyc_status kyc_status_enum NOT NULL DEFAULT 'not_submitted';

-- 3. Create kyc_submissions table
CREATE TABLE IF NOT EXISTS kyc_submissions (
    id                  uuid primary key default uuid_generate_v4(),
    distributor_id      uuid not null references profiles(id) on delete cascade,
    id_type             text not null check (id_type in ('national_id', 'passport', 'voter_id', 'driver_license')),
    id_number           text not null,
    document_front_url  text not null,
    document_back_url   text, -- nullable for documents without a back
    selfie_url          text, -- optional selfie-with-ID for liveness
    status              kyc_status_enum not null default 'pending',
    submitted_at        timestamptz not null default now(),
    reviewed_by         uuid references profiles(id) on delete set null,
    reviewed_at         timestamptz,
    rejection_reason    text
);

CREATE INDEX IF NOT EXISTS idx_kyc_submissions_distributor ON kyc_submissions(distributor_id);
CREATE INDEX IF NOT EXISTS idx_kyc_submissions_status ON kyc_submissions(status);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE kyc_submissions ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies
-- kyc_submissions policies
DROP POLICY IF EXISTS kyc_submissions_self_select ON kyc_submissions;
CREATE POLICY kyc_submissions_self_select ON kyc_submissions FOR SELECT USING (auth.uid() = distributor_id);

DROP POLICY IF EXISTS kyc_submissions_self_insert ON kyc_submissions;
CREATE POLICY kyc_submissions_self_insert ON kyc_submissions FOR INSERT WITH CHECK (auth.uid() = distributor_id);

DROP POLICY IF EXISTS kyc_submissions_self_update ON kyc_submissions;
CREATE POLICY kyc_submissions_self_update ON kyc_submissions FOR UPDATE USING (auth.uid() = distributor_id);

DROP POLICY IF EXISTS kyc_submissions_staff_all ON kyc_submissions;
CREATE POLICY kyc_submissions_staff_all ON kyc_submissions FOR ALL USING (public.is_staff());

-- 6. Trigger Function to update denormalized kyc_status on profiles when submission changes
CREATE OR REPLACE FUNCTION public.handle_kyc_submission_update()
RETURNS TRIGGER AS $$
BEGIN
  -- Update the denormalized kyc_status on profiles
  UPDATE public.profiles
  SET kyc_status = NEW.status
  WHERE id = NEW.distributor_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for inserts
DROP TRIGGER IF EXISTS trg_kyc_submissions_insert ON public.kyc_submissions;
CREATE TRIGGER trg_kyc_submissions_insert
AFTER INSERT ON public.kyc_submissions
FOR EACH ROW
EXECUTE FUNCTION public.handle_kyc_submission_update();

-- Create trigger for updates
DROP TRIGGER IF EXISTS trg_kyc_submissions_update ON public.kyc_submissions;
CREATE TRIGGER trg_kyc_submissions_update
AFTER UPDATE ON public.kyc_submissions
FOR EACH ROW
EXECUTE FUNCTION public.handle_kyc_submission_update();

-- 7. Function to get latest KYC submission for a distributor
CREATE OR REPLACE FUNCTION public.get_latest_kyc_submission(p_distributor_id uuid)
RETURNS TABLE (
  id uuid,
  distributor_id uuid,
  id_type text,
  id_number text,
  document_front_url text,
  document_back_url text,
  selfie_url text,
  status kyc_status_enum,
  submitted_at timestamptz,
  reviewed_by uuid,
  reviewed_at timestamptz,
  rejection_reason text
) LANGUAGE sql SECURITY DEFINER AS $$
SELECT 
  ks.id,
  ks.distributor_id,
  ks.id_type,
  ks.id_number,
  ks.document_front_url,
  ks.document_back_url,
  ks.selfie_url,
  ks.status,
  ks.submitted_at,
  ks.reviewed_by,
  ks.reviewed_at,
  ks.rejection_reason
FROM public.kyc_submissions ks
WHERE ks.distributor_id = p_distributor_id
ORDER BY ks.submitted_at DESC
LIMIT 1;
$$;
