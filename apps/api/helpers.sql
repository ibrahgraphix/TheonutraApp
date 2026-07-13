-- ================================================================
-- Helper SQL functions — run in Supabase SQL Editor
-- ================================================================
-- These SECURITY DEFINER functions let the backend call complex
-- operations (profile creation/update) as a single RPC call,
-- bypassing the PostgREST schema cache for columns that PostgREST
-- might not have picked up yet after a manual schema apply.
-- ================================================================

-- Creates or updates a profile row. Called by:
--   • seedAdmin.ts  (admin bootstrap)
--   • sellers.service.ts  (createSeller, Step 3)
create or replace function public.upsert_profile(
  p_id               uuid,
  p_distributor_id   text,
  p_full_name        text,
  p_phone_number     text,
  p_role             user_role,
  p_country_id       uuid,
  p_referred_by      uuid default null,
  p_is_active        boolean default true,
  p_must_change_password boolean default true,
  p_created_by       uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (
    id, distributor_id, full_name, phone_number, role,
    country_id, referred_by, is_active, must_change_password, created_by
  )
  values (
    p_id, p_distributor_id, p_full_name, p_phone_number, p_role,
    p_country_id, p_referred_by, p_is_active, p_must_change_password, p_created_by
  )
  on conflict (id) do update set
    distributor_id       = excluded.distributor_id,
    full_name            = excluded.full_name,
    phone_number         = excluded.phone_number,
    role                 = excluded.role,
    country_id           = excluded.country_id,
    referred_by          = excluded.referred_by,
    is_active            = excluded.is_active,
    must_change_password = excluded.must_change_password;
end;
$$;

-- Grant execute to service_role (the backend's key) and authenticated users
grant execute on function public.upsert_profile to service_role;
