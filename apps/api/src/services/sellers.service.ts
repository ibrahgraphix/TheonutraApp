import { supabase } from '../config/supabase.js';
import { ApiError } from '../middleware/error.middleware.js';
import { isDistributorIdTaken } from '../utils/idValidation.js';
import { distributorIdToEmail } from '../utils/distributorAuth.js';
import { CreateSellerInput } from '../schemas/sellers.schema.js';

export interface SellerProfile {
  id: string;
  distributorId: string;
  fullName: string;
  phoneNumber: string;
  role: string;
  countryId: string;
  countryName?: string;
  referredBy: string | null;
  isActive: boolean;
  mustChangePassword: boolean;
  directDownlineCount: number;
  createdAt: string;
}

/**
 * Creates a new distributor or staff seller account.
 * Accessible only by staff (admin/company_staff).
 */
export async function createSeller(
  input: CreateSellerInput,
  adminUserId: string,
  adminUserRole: string
): Promise<SellerProfile> {
  // 1. Check if ID is taken
  const isTaken = await isDistributorIdTaken(input.distributorId);
  if (isTaken) {
    throw new ApiError(409, 'Distributor ID already in use');
  }

  // 2. Role restriction: Only admin can assign 'admin' or 'company_staff' roles
  const finalRole = input.role || 'distributor';
  if (finalRole !== 'distributor' && adminUserRole !== 'admin') {
    throw new ApiError(403, 'Only admins can assign staff roles');
  }

  // 3. Generate synthetic internal email
  const email = distributorIdToEmail(input.distributorId);

  // 4. Create auth user via Supabase Auth Admin API
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password: input.password,
    email_confirm: true,
    app_metadata: { role: finalRole },
  });

  if (authError || !authData.user) {
    throw new ApiError(400, authError?.message || 'Failed to create auth user');
  }

  const userId = authData.user.id;

  // 5. Create the profile row using the upsert_profile RPC helper to bypass PostgREST cache issues
  const { error: profileError } = await supabase.rpc('upsert_profile', {
    p_id: userId,
    p_distributor_id: input.distributorId,
    p_full_name: input.fullName,
    p_phone_number: input.phoneNumber,
    p_role: finalRole,
    p_country_id: input.countryId,
    p_referred_by: input.referredBy || null,
    p_is_active: true,
    p_must_change_password: true, // Forces reset on first login
    p_created_by: adminUserId,
  });

  if (profileError) {
    // Clean up orphaned auth record
    await supabase.auth.admin.deleteUser(userId);
    throw new ApiError(500, `Failed to create seller profile: ${profileError.message}`);
  }

  // 6. Retrieve and shape the completed profile
  return getSellerById(userId);
}

/**
 * Lists all seller profiles with pagination, search, country join, and downline count.
 */
export async function listSellers(
  search?: string,
  page: number = 1,
  limit: number = 20
): Promise<SellerProfile[]> {
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  let query = supabase
    .from('profiles')
    .select(`
      *,
      countries (
        name
      )
    `)
    .order('created_at', { ascending: false })
    .range(from, to);

  if (search && search.trim() !== '') {
    const cleanSearch = search.trim();
    query = query.or(`distributor_id.ilike.%${cleanSearch}%,full_name.ilike.%${cleanSearch}%`);
  }

  const { data: profiles, error } = await query;

  if (error) {
    throw new ApiError(500, `Failed to list sellers: ${error.message}`);
  }

  if (!profiles || profiles.length === 0) {
    return [];
  }

  // Fetch direct downline counts in bulk to avoid N+1 queries
  const sellerIds = profiles.map((p) => p.id);
  const { data: downlines, error: downlineError } = await supabase
    .from('profiles')
    .select('referred_by')
    .in('referred_by', sellerIds);

  if (downlineError) {
    throw new ApiError(500, `Failed to load downline counts: ${downlineError.message}`);
  }

  // Map sponsor IDs to counts
  const downlineCounts: Record<string, number> = {};
  for (const d of downlines || []) {
    if (d.referred_by) {
      downlineCounts[d.referred_by] = (downlineCounts[d.referred_by] || 0) + 1;
    }
  }

  return profiles.map((p) => ({
    id: p.id,
    distributorId: p.distributor_id,
    fullName: p.full_name,
    phoneNumber: p.phone_number,
    role: p.role,
    countryId: p.country_id,
    countryName: (p.countries as any)?.name || 'Unknown',
    referredBy: p.referred_by,
    isActive: p.is_active,
    mustChangePassword: p.must_change_password,
    directDownlineCount: downlineCounts[p.id] || 0,
    createdAt: p.created_at,
  }));
}

/**
 * Retrieves a single seller profile by ID, including country name and direct downline count.
 */
export async function getSellerById(id: string): Promise<SellerProfile> {
  const { data: profile, error } = await supabase
    .from('profiles')
    .select(`
      *,
      countries (
        name
      )
    `)
    .eq('id', id)
    .single();

  if (error || !profile) {
    throw new ApiError(404, 'Seller profile not found');
  }

  // Get direct downline count (referred_by = current user id)
  const { count, error: countError } = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true })
    .eq('referred_by', id);

  if (countError) {
    throw new ApiError(500, `Failed to retrieve direct team count: ${countError.message}`);
  }

  return {
    id: profile.id,
    distributorId: profile.distributor_id,
    fullName: profile.full_name,
    phoneNumber: profile.phone_number,
    role: profile.role,
    countryId: profile.country_id,
    countryName: (profile.countries as any)?.name || 'Unknown',
    referredBy: profile.referred_by,
    isActive: profile.is_active,
    mustChangePassword: profile.must_change_password,
    directDownlineCount: count || 0,
    createdAt: profile.created_at,
  };
}

/**
 * Resets a seller's password and sets must_change_password to true.
 */
export async function resetSellerPassword(
  sellerId: string,
  newPassword: string
): Promise<void> {
  // Ensure seller profile exists
  const profile = await getSellerById(sellerId);

  if (profile.role !== 'distributor') {
    throw new ApiError(400, 'Cannot reset password for non-seller account');
  }

  // Update password in Auth
  const { error: authError } = await supabase.auth.admin.updateUserById(sellerId, {
    password: newPassword,
  });

  if (authError) {
    throw new ApiError(500, `Failed to update auth password: ${authError.message}`);
  }

  // Update must_change_password to true on the profile row
  const { error: profileError } = await supabase
    .from('profiles')
    .update({ must_change_password: true })
    .eq('id', sellerId);

  if (profileError) {
    throw new ApiError(500, `Failed to update profile must_change_password flag: ${profileError.message}`);
  }
}

/**
 * Deactivates a seller account (soft delete).
 */
export async function deactivateSeller(sellerId: string): Promise<void> {
  // Ensure seller profile exists
  await getSellerById(sellerId);

  const { error } = await supabase
    .from('profiles')
    .update({ is_active: false })
    .eq('id', sellerId);

  if (error) {
    throw new ApiError(500, `Failed to deactivate seller: ${error.message}`);
  }
}
