import { supabase } from '../config/supabase.js';
import { ApiError } from '../middleware/error.middleware.js';
import { isDistributorIdTaken } from '../utils/idValidation.js';
import { distributorIdToEmail } from '../utils/distributorAuth.js';
import { CreateSellerInput } from '../schemas/sellers.schema.js';
import * as notificationService from './notification.service.js';
import { deleteCloudinaryAsset } from './uploads.service.js';
import { applyPlacementToProfile, listStarRanks } from './compensationEngine.service.js';

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
  rankId?: string | null;
  photoUrl?: string | null;
}

export interface UpdateSellerInput {
  fullName?: string;
  phoneNumber?: string;
  countryId?: string;
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

  // 3. Resolve countryId: UUID, ISO code (e.g. KE), or country name (e.g. Kenya)
  let countryId = input.countryId;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(countryId)) {
    countryId = await resolveCountryId(countryId);
  }

  // 4. Resolve referredBy: if provided and not a UUID, look up by distributor_id
  let referredBy = input.referredBy;
  if (referredBy && !uuidRegex.test(referredBy)) {
    // Assume it's a distributor ID, look up the UUID
    const { data: referrer, error: referrerError } = await supabase
      .from('profiles')
      .select('id')
      .eq('distributor_id', referredBy)
      .single();
    
    if (referrerError || !referrer) {
      throw new ApiError(400, `Invalid referrer distributor ID: ${referredBy}`);
    }
    referredBy = referrer.id;
  }

  // 5. Generate synthetic internal email
  const email = distributorIdToEmail(input.distributorId);

  // 6. Create auth user via Supabase Auth Admin API
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

  // 7. Create the profile row using the upsert_profile RPC helper to bypass PostgREST cache issues
  const { error: profileError } = await supabase.rpc('upsert_profile', {
    p_id: userId,
    p_distributor_id: input.distributorId,
    p_full_name: input.fullName,
    p_phone_number: input.phoneNumber,
    p_role: finalRole,
    p_country_id: countryId,
    p_referred_by: referredBy || null,
    p_is_active: true,
    p_must_change_password: true, // Forces reset on first login
    p_created_by: adminUserId,
  });

  if (profileError) {
    // Clean up orphaned auth record
    await supabase.auth.admin.deleteUser(userId);
    throw new ApiError(500, `Failed to create seller profile: ${profileError.message}`);
  }

  // Look up starting 'Member' rank
  const { data: memberRank, error: rankError } = await supabase
    .from('ranks')
    .select('id')
    .eq('name', 'Member')
    .single();

  if (rankError || !memberRank) {
    // Clean up profile and auth user
    await supabase.from('profiles').delete().eq('id', userId);
    await supabase.auth.admin.deleteUser(userId);
    throw new ApiError(500, `Failed to look up starting 'Member' rank: ${rankError?.message || 'Not found'}`);
  }

  // Update the newly created profile with the Member rank ID + Star 1
  const starRanks = await listStarRanks();
  const star1 = starRanks.find((r) => r.code === 'STAR_1') ?? starRanks[0];

  const { error: rankUpdateError } = await supabase
    .from('profiles')
    .update({
      rank_id: memberRank.id,
      ...(star1 ? { star_rank_id: star1.id } : {}),
    })
    .eq('id', userId);

  if (rankUpdateError) {
    // Clean up
    await supabase.from('profiles').delete().eq('id', userId);
    await supabase.auth.admin.deleteUser(userId);
    throw new ApiError(500, `Failed to assign starting rank: ${rankUpdateError.message}`);
  }

  // 3-leg placement (spillover if sponsor's Left/Center/Right are full)
  if (referredBy && finalRole === 'distributor') {
    try {
      await applyPlacementToProfile(userId, referredBy);
    } catch (placementError) {
      console.error(`❌ Failed to assign 3-leg placement: ${placementError}`);
    }
  }

  // 7.5. Notify the upline if this distributor was referred
  if (referredBy) {
    try {
      await notificationService.notifyNewReferral(
        referredBy,
        input.fullName,
        input.distributorId,
      );
    } catch (notifError) {
      console.error(`❌ Failed to send new referral notification: ${notifError}`);
      // Don't throw - notification failure shouldn't break the seller creation
    }
  }

  // 8. Retrieve and shape the completed profile
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
    rankId: p.rank_id,
    photoUrl: p.photo_url ?? null,
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
    rankId: profile.rank_id,
    photoUrl: profile.photo_url ?? null,
  };
}

/**
 * Updates editable fields on an existing seller profile (name, phone, country).
 * Does not touch role, password, or active status — use the dedicated
 * endpoints for those.
 */
export async function updateSeller(
  sellerId: string,
  input: UpdateSellerInput,
): Promise<SellerProfile> {
  // Ensure the seller exists (throws 404 otherwise)
  await getSellerById(sellerId);

  const patch: Record<string, unknown> = {};

  if (input.fullName !== undefined) {
    patch['full_name'] = input.fullName;
  }
  if (input.phoneNumber !== undefined) {
    patch['phone_number'] = input.phoneNumber;
  }
  if (input.countryId !== undefined) {
    let countryId = input.countryId;
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(countryId)) {
      countryId = await resolveCountryId(countryId);
    }
    patch['country_id'] = countryId;
  }

  if (Object.keys(patch).length === 0) {
    throw new ApiError(422, 'No updatable fields provided');
  }

  const { error } = await supabase
    .from('profiles')
    .update(patch)
    .eq('id', sellerId);

  if (error) {
    throw new ApiError(500, `Failed to update seller: ${error.message}`);
  }

  return getSellerById(sellerId);
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
 * Resolves a country reference (ISO code or display name) to its UUID.
 */
async function resolveCountryId(countryRef: string): Promise<string> {
  const trimmed = countryRef.trim();
  if (!trimmed) {
    throw new ApiError(400, 'countryId is required');
  }

  // Prefer ISO code match (e.g. KE, TZ)
  const { data: byIso } = await supabase
    .from('countries')
    .select('id')
    .eq('is_active', true)
    .eq('iso_code', trimmed.toUpperCase())
    .maybeSingle();

  if (byIso?.id) {
    return byIso.id as string;
  }

  // Fall back to case-insensitive name match (e.g. Kenya)
  const { data: byName } = await supabase
    .from('countries')
    .select('id')
    .eq('is_active', true)
    .ilike('name', trimmed)
    .maybeSingle();

  if (byName?.id) {
    return byName.id as string;
  }

  throw new ApiError(400, `Invalid country code: ${countryRef}`);
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

/**
 * Checks whether a seller has any history that makes hard-deletion unsafe:
 * downline recruits, orders, commissions, or customer sales. If any exist,
 * hard-deleting would break the downline tree and financial ledgers.
 */
async function sellerHasHistory(
  sellerId: string,
): Promise<{ hasHistory: boolean; reasons: string[] }> {
  const reasons: string[] = [];

  const { count: downlineCount, error: downlineError } = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true })
    .eq('referred_by', sellerId);
  if (downlineError) {
    throw new ApiError(500, `Failed to check downline: ${downlineError.message}`);
  }
  if ((downlineCount ?? 0) > 0) {
    reasons.push(`${downlineCount} downline recruit(s)`);
  }

  const { count: orderCount, error: orderError } = await supabase
    .from('orders')
    .select('*', { count: 'exact', head: true })
    .eq('buyer_id', sellerId);
  if (orderError) {
    throw new ApiError(500, `Failed to check orders: ${orderError.message}`);
  }
  if ((orderCount ?? 0) > 0) {
    reasons.push(`${orderCount} order(s)`);
  }

  const { count: commissionCount, error: commissionError } = await supabase
    .from('commissions')
    .select('*', { count: 'exact', head: true })
    .eq('beneficiary_id', sellerId);
  if (commissionError) {
    throw new ApiError(500, `Failed to check commissions: ${commissionError.message}`);
  }
  if ((commissionCount ?? 0) > 0) {
    reasons.push(`${commissionCount} commission(s)`);
  }

  const { count: saleCount, error: saleError } = await supabase
    .from('customer_sales')
    .select('*', { count: 'exact', head: true })
    .eq('distributor_id', sellerId);
  if (saleError) {
    throw new ApiError(500, `Failed to check customer sales: ${saleError.message}`);
  }
  if ((saleCount ?? 0) > 0) {
    reasons.push(`${saleCount} customer sale(s)`);
  }

  return { hasHistory: reasons.length > 0, reasons };
}

export async function hardDeleteSeller(sellerId: string): Promise<void> {
  await getSellerById(sellerId);

  const { hasHistory, reasons } = await sellerHasHistory(sellerId);
  if (hasHistory) {
    throw new ApiError(
      409,
      `Cannot permanently delete this distributor — they have ${reasons.join(
        ', ',
      )}. Deactivate the account instead.`,
    );
  }

  const { data: kycRows, error: kycFetchError } = await supabase
    .from('kyc_submissions')
    .select('document_front_url, document_back_url, selfie_url')
    .eq('distributor_id', sellerId);

  if (kycFetchError) {
    throw new ApiError(500, `Failed to fetch KYC documents: ${kycFetchError.message}`);
  }

  for (const row of kycRows ?? []) {
    await deleteCloudinaryAsset(row.document_front_url as string | null);
    await deleteCloudinaryAsset(row.document_back_url as string | null);
    await deleteCloudinaryAsset(row.selfie_url as string | null);
  }

  const { data: sellerProfile } = await supabase
    .from('profiles')
    .select('photo_url')
    .eq('id', sellerId)
    .maybeSingle();
  await deleteCloudinaryAsset(sellerProfile?.photo_url as string | null);

  const { error: kycDeleteError } = await supabase
    .from('kyc_submissions')
    .delete()
    .eq('distributor_id', sellerId);

  if (kycDeleteError) {
    throw new ApiError(500, `Failed to delete KYC submissions: ${kycDeleteError.message}`);
  }

  const { error: profileDeleteError } = await supabase
    .from('profiles')
    .delete()
    .eq('id', sellerId);

  if (profileDeleteError) {
    throw new ApiError(500, `Failed to delete profile: ${profileDeleteError.message}`);
  }

  const { error: authDeleteError } = await supabase.auth.admin.deleteUser(sellerId);
  if (authDeleteError) {
    console.warn(
      `[Sellers] Failed to delete auth user ${sellerId}: ${authDeleteError.message}`,
    );
  }
}
/**
 * Reactivates a previously deactivated seller account.
 */
export async function activateSeller(sellerId: string): Promise<void> {
  await getSellerById(sellerId);

  const { error } = await supabase
    .from('profiles')
    .update({ is_active: true })
    .eq('id', sellerId);

  if (error) {
    throw new ApiError(500, `Failed to activate seller: ${error.message}`);
  }
}