-- =========================================================
-- Step 18 Migration: Referral Code/Link + QR
-- =========================================================

-- 1. Add referral_code column to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS referral_code text unique;

-- 2. Create index for faster referral code lookups
CREATE INDEX IF NOT EXISTS idx_profiles_referral_code ON profiles(referral_code);

-- 3. Function to generate a unique referral code
CREATE OR REPLACE FUNCTION public.generate_referral_code()
RETURNS text AS $$
DECLARE
  v_code text;
  v_exists boolean;
  v_attempts int := 0;
BEGIN
  -- Try up to 10 times to generate a unique code
  WHILE v_attempts < 10 LOOP
    -- Generate a random 8-character alphanumeric code (uppercase letters and numbers)
    v_code := upper(substring(encode(gen_random_bytes(6), 'base64'), 1, 8));
    -- Remove any non-alphanumeric characters that might be in base64
    v_code := regexp_replace(v_code, '[^A-Z0-9]', '', 'g');
    
    -- Ensure it's exactly 8 characters
    IF length(v_code) < 8 THEN
      -- Pad with random letters if needed
      v_code := v_code || upper(substring(encode(gen_random_bytes(4), 'base64'), 1, 8 - length(v_code)));
      v_code := regexp_replace(v_code, '[^A-Z0-9]', '', 'g');
    END IF;
    
    -- Check if this code already exists
    SELECT EXISTS(SELECT 1 FROM profiles WHERE referral_code = v_code) INTO v_exists;
    
    IF NOT v_exists THEN
      RETURN v_code;
    END IF;
    
    v_attempts := v_attempts + 1;
  END LOOP;
  
  -- If we couldn't generate a unique code after 10 attempts, raise an error
  RAISE EXCEPTION 'Failed to generate unique referral code after 10 attempts';
END;
$$ LANGUAGE plpgsql;

-- 4. Trigger to auto-generate referral code on profile creation
CREATE OR REPLACE FUNCTION public.handle_profile_insert()
RETURNS TRIGGER AS $$
BEGIN
  -- Generate referral code if not provided
  IF NEW.referral_code IS NULL OR NEW.referral_code = '' THEN
    NEW.referral_code := public.generate_referral_code();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for inserts
DROP TRIGGER IF EXISTS trg_profiles_referral_code_insert ON public.profiles;
CREATE TRIGGER trg_profiles_referral_code_insert
BEFORE INSERT ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.handle_profile_insert();

-- 5. Function to validate referral code and return distributor info
CREATE OR REPLACE FUNCTION public.validate_referral_code(p_code text)
RETURNS TABLE (
  distributor_id uuid,
  full_name text,
  is_active boolean
) LANGUAGE sql SECURITY DEFINER AS $$
SELECT 
  p.id,
  p.full_name,
  p.is_active
FROM public.profiles p
WHERE p.referral_code = upper(p_code)
  AND p.is_active = true
LIMIT 1;
$$;

-- 6. Function to regenerate referral code for a distributor
CREATE OR REPLACE FUNCTION public.regenerate_referral_code(p_distributor_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_new_code text;
BEGIN
  -- Generate new code
  v_new_code := public.generate_referral_code();
  
  -- Update profile
  UPDATE public.profiles
  SET referral_code = v_new_code,
      updated_at = now()
  WHERE id = p_distributor_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Distributor not found';
  END IF;
  
  RETURN v_new_code;
END;
$$;
