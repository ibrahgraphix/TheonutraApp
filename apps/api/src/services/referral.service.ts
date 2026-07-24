import { supabase } from '../config/supabase.js';
import { ApiError } from '../middleware/error.middleware.js';
import { env } from '../config/env.js';

export interface ReferralInfo {
  referral_code: string;
  referral_link: string;
}

export interface ReferralValidation {
  distributor_id: string;
  full_name: string;
  is_active: boolean;
}

/**
 * Gets the referral code and shareable link for a distributor.
 * The frontend can use the referral_link string to generate a QR code client-side.
 */
export async function getMyReferralInfo(distributorId: string): Promise<ReferralInfo> {
  const { data: profile, error: fetchError } = await supabase
    .from('profiles')
    .select('referral_code')
    .eq('id', distributorId)
    .single();

  if (fetchError || !profile) {
    throw new ApiError(404, 'Profile not found');
  }

  if (!profile.referral_code) {
    throw new ApiError(500, 'Referral code not found for this distributor');
  }

  // Generate shareable link
  const referralLink = `${env.FRONTEND_URL || 'https://app.domain'}/join?ref=${profile.referral_code}`;

  return {
    referral_code: profile.referral_code,
    referral_link: referralLink,
  };
}

/**
 * Validates a referral code and returns the distributor info if valid.
 * Used during signup to resolve the code to an upline distributor id.
 * Returns error if code invalid/inactive.
 */
export async function validateReferralCode(code: string): Promise<ReferralValidation> {
  if (!code || code.trim().length === 0) {
    throw new ApiError(400, 'Referral code is required');
  }

  const { data, error } = await supabase.rpc('validate_referral_code', {
    p_code: code.trim(),
  });

  if (error) {
    throw new ApiError(500, `Failed to validate referral code: ${error.message}`);
  }

  if (!data || data.length === 0) {
    throw new ApiError(404, 'Invalid or inactive referral code');
  }

  const result = data[0] as any;
  return {
    distributor_id: result.distributor_id,
    full_name: result.full_name,
    is_active: result.is_active,
  };
}

/**
 * Regenerates a new referral code for a distributor (staff only).
 * Invalidates the old code - old code will no longer validate.
 */
export async function regenerateReferralCode(distributorId: string): Promise<string> {
  const { data, error } = await supabase.rpc('regenerate_referral_code', {
    p_distributor_id: distributorId,
  });

  if (error) {
    if (error.message.includes('Distributor not found')) {
      throw new ApiError(404, 'Distributor not found');
    }
    throw new ApiError(500, `Failed to regenerate referral code: ${error.message}`);
  }

  return data as string;
}

/**
 * Gets distributor info by referral code (helper function).
 * Similar to validateReferralCode but doesn't throw on not found.
 */
export async function getDistributorByReferralCode(code: string): Promise<ReferralValidation | null> {
  if (!code || code.trim().length === 0) {
    return null;
  }

  const { data, error } = await supabase.rpc('validate_referral_code', {
    p_code: code.trim(),
  });

  if (error) {
    return null;
  }

  if (!data || data.length === 0) {
    return null;
  }

  const result = data[0] as any;
  return {
    distributor_id: result.distributor_id,
    full_name: result.full_name,
    is_active: result.is_active,
  };
}
