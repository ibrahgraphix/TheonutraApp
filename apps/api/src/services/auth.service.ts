import { supabase } from '../config/supabase.js';
import { ApiError } from '../middleware/error.middleware.js';
import { distributorIdToEmail } from '../utils/distributorAuth.js';

export interface LoginResult {
  token: string;
  user: {
    id: string;
    distributorId: string;
    fullName: string;
    role: string;
    country: string;
    countryId: string;
    mustChangePassword: boolean;
  };
}

/**
 * Authenticates a distributor by their human-facing Distributor ID + password.
 *
 * Flow:
 *  1. Map Distributor ID → synthetic internal email
 *  2. Sign in via Supabase Auth (signInWithPassword)
 *  3. Fetch the matching profiles row to get role, name, flags
 *  4. Guard against deactivated accounts
 *  5. Return the JWT access token + safe profile fields (never the internal email)
 */
export async function login(
  distributorId: string,
  password: string,
): Promise<LoginResult> {
  const email = distributorIdToEmail(distributorId);

  // Step 2 — authenticate. A single vague error message regardless of whether
  // the ID doesn't exist or the password is wrong (prevents user enumeration).
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (authError || !authData.session) {
    throw new ApiError(401, 'Invalid Distributor ID or password');
  }

  const userId = authData.user.id;

  // Step 3 — fetch profile (service role key bypasses RLS, so this always works)
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select(`
      distributor_id,
      full_name,
      role,
      must_change_password,
      is_active,
      country_id,
      countries (
        name
      )
    `)
    .eq('id', userId)
    .single();

  if (profileError || !profile) {
    // Auth user exists but has no matching profile — data inconsistency
    throw new ApiError(500, 'Profile not found for authenticated user');
  }

  // Step 4 — deactivated accounts get a 403, not a 401
  if (!profile.is_active) {
    throw new ApiError(403, 'Account is deactivated');
  }

  const countryName =
    (profile.countries as { name?: string } | null)?.name ?? '';

  // Step 5 — return token + safe fields only
  return {
    token: authData.session.access_token,
    user: {
      id: userId,
      distributorId: profile.distributor_id as string,
      fullName: profile.full_name as string,
      role: profile.role as string,
      country: countryName,
      countryId: profile.country_id as string,
      mustChangePassword: profile.must_change_password as boolean,
    },
  };
}
