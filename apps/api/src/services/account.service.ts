import { supabase } from '../config/supabase.js';
import { ApiError } from '../middleware/error.middleware.js';
import { distributorIdToEmail } from '../utils/distributorAuth.js';

/**
 * Changes a user's password after verifying the current password.
 *
 * @param userId UUID of the user
 * @param currentPassword Current password for verification
 * @param newPassword New password to set
 */
export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  // 1. Fetch the user's profile to get their distributor_id (needed for email)
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('distributor_id')
    .eq('id', userId)
    .single();

  if (profileError || !profile) {
    throw new ApiError(404, 'Profile not found');
  }

  // 2. Verify current password by attempting to sign in
  const email = distributorIdToEmail(profile.distributor_id);
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email,
    password: currentPassword,
  });

  if (authError || !authData.session) {
    throw new ApiError(401, 'Current password is incorrect');
  }

  // 3. Update password via Admin API
  const { error: updateError } = await supabase.auth.admin.updateUserById(userId, {
    password: newPassword,
  });

  if (updateError) {
    throw new ApiError(500, `Failed to update password: ${updateError.message}`);
  }

  // 4. Set must_change_password to false on the profile
  const { error: profileUpdateError } = await supabase
    .from('profiles')
    .update({ must_change_password: false })
    .eq('id', userId);

  if (profileUpdateError) {
    throw new ApiError(500, `Failed to update profile: ${profileUpdateError.message}`);
  }
}

/**
 * Changes a user's phone number.
 *
 * @param userId UUID of the user
 * @param newPhoneNumber New phone number
 */
export async function changePhoneNumber(
  userId: string,
  newPhoneNumber: string,
): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ phone_number: newPhoneNumber })
    .eq('id', userId);

  if (error) {
    throw new ApiError(500, `Failed to update phone number: ${error.message}`);
  }
}

/**
 * Deactivates the user's own account (soft delete).
 * Note: This does not invalidate the current session - that's a known gap.
 *
 * @param userId UUID of the user
 */
export async function deactivateOwnAccount(userId: string): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ is_active: false })
    .eq('id', userId);

  if (error) {
    throw new ApiError(500, `Failed to deactivate account: ${error.message}`);
  }

  // KNOWN GAP: We don't invalidate the current session here.
  // Supabase Auth doesn't provide a simple way to revoke a specific session
  // without additional infrastructure. The user will be blocked on their next
  // login attempt since is_active is checked in the login flow.
}

/**
 * Gets the user's payment method details.
 *
 * @param userId UUID of the user
 */
export async function getPaymentMethod(userId: string): Promise<{
  payment_method: string | null;
  payment_full_name: string | null;
  payment_account_number: string | null;
}> {
  const { data, error } = await supabase
    .from('profiles')
    .select('payment_method, payment_full_name, payment_account_number')
    .eq('id', userId)
    .single();

  if (error) {
    throw new ApiError(500, `Failed to fetch payment method: ${error.message}`);
  }

  return {
    payment_method: data.payment_method,
    payment_full_name: data.payment_full_name,
    payment_account_number: data.payment_account_number,
  };
}

/**
 * Updates the user's payment method details.
 *
 * @param userId UUID of the user
 * @param paymentMethod Payment method (M-Pesa, Airtel Money, etc.)
 * @param fullName Full name for payments
 * @param accountNumber Account number or phone number
 */
export async function updatePaymentMethod(
  userId: string,
  paymentMethod: string,
  fullName: string,
  accountNumber: string,
): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({
      payment_method: paymentMethod,
      payment_full_name: fullName,
      payment_account_number: accountNumber,
    })
    .eq('id', userId);

  if (error) {
    throw new ApiError(500, `Failed to update payment method: ${error.message}`);
  }
}
