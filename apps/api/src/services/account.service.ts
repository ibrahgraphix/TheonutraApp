import { supabase } from '../config/supabase.js';
import { ApiError } from '../middleware/error.middleware.js';
import { distributorIdToEmail } from '../utils/distributorAuth.js';
import * as notificationService from './notification.service.js';
import { deleteCloudinaryAsset } from './uploads.service.js';

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
  const { data: profile } = await supabase
    .from('profiles')
    .select('photo_url')
    .eq('id', userId)
    .maybeSingle();

  if (profile?.photo_url) {
    await deleteCloudinaryAsset(profile.photo_url);
  }

  const { error } = await supabase
    .from('profiles')
    .update({ is_active: false, photo_url: null })
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
  pendingChange: {
    id: string;
    new_payment_method: string;
    new_payment_full_name: string;
    new_payment_account_number: string;
    status: string;
    created_at: string;
  } | null;
}> {
  const { data, error } = await supabase
    .from('profiles')
    .select('payment_method, payment_full_name, payment_account_number')
    .eq('id', userId)
    .single();

  if (error) {
    throw new ApiError(500, `Failed to fetch payment method: ${error.message}`);
  }

  const { data: pending } = await supabase
    .from('payment_method_change_requests')
    .select('id, new_payment_method, new_payment_full_name, new_payment_account_number, status, created_at')
    .eq('distributor_id', userId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return {
    payment_method: data.payment_method,
    payment_full_name: data.payment_full_name,
    payment_account_number: data.payment_account_number,
    pendingChange: pending ?? null,
  };
}

/**
 * Submits a payment method change request (does NOT update live profile).
 * Staff must confirm before the live number changes.
 */
export async function requestPaymentMethodChange(
  userId: string,
  paymentMethod: string,
  fullName: string,
  accountNumber: string,
): Promise<{ requestId: string }> {
  const { data: existingPending } = await supabase
    .from('payment_method_change_requests')
    .select('id')
    .eq('distributor_id', userId)
    .eq('status', 'pending')
    .maybeSingle();

  if (existingPending) {
    throw new ApiError(409, 'You already have a pending payment method change request');
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('payment_method, payment_full_name, payment_account_number, full_name, distributor_id')
    .eq('id', userId)
    .single();

  if (profileError || !profile) {
    throw new ApiError(404, 'Profile not found');
  }

  const { data: request, error } = await supabase
    .from('payment_method_change_requests')
    .insert({
      distributor_id: userId,
      old_payment_method: profile.payment_method,
      old_payment_full_name: profile.payment_full_name,
      old_payment_account_number: profile.payment_account_number,
      new_payment_method: paymentMethod,
      new_payment_full_name: fullName,
      new_payment_account_number: accountNumber,
      status: 'pending',
    })
    .select('id')
    .single();

  if (error || !request) {
    throw new ApiError(500, `Failed to create payment change request: ${error?.message}`);
  }

  await notificationService.broadcastToStaff(
    'Payment Method Change Request',
    `${profile.full_name} (${profile.distributor_id}) requests change from ${profile.payment_account_number ?? 'none'} → ${accountNumber}`,
    {
      requestId: request.id,
      distributorId: userId,
      fullName: profile.full_name,
      oldAccount: profile.payment_account_number,
      newAccount: accountNumber,
      newMethod: paymentMethod,
    },
  );

  return { requestId: request.id };
}

/** @deprecated Use requestPaymentMethodChange — kept name for controller compatibility */
export async function updatePaymentMethod(
  userId: string,
  paymentMethod: string,
  fullName: string,
  accountNumber: string,
): Promise<void> {
  await requestPaymentMethodChange(userId, paymentMethod, fullName, accountNumber);
}

export async function listPendingPaymentMethodChanges(): Promise<any[]> {
  const { data, error } = await supabase
    .from('payment_method_change_requests')
    .select(`
      *,
      profiles!payment_method_change_requests_distributor_id_fkey ( full_name, distributor_id )
    `)
    .eq('status', 'pending')
    .order('created_at', { ascending: true });

  if (error) throw new ApiError(500, `Failed to list payment change requests: ${error.message}`);
  return data ?? [];
}

export async function approvePaymentMethodChange(requestId: string, staffId: string): Promise<void> {
  const { data: req, error: fetchError } = await supabase
    .from('payment_method_change_requests')
    .select('*')
    .eq('id', requestId)
    .single();

  if (fetchError || !req) throw new ApiError(404, 'Change request not found');
  if (req.status !== 'pending') throw new ApiError(422, 'Request is not pending');

  const { error: profileError } = await supabase
    .from('profiles')
    .update({
      payment_method: req.new_payment_method,
      payment_full_name: req.new_payment_full_name,
      payment_account_number: req.new_payment_account_number,
    })
    .eq('id', req.distributor_id);

  if (profileError) throw new ApiError(500, `Failed to update payment method: ${profileError.message}`);

  const { error: updError } = await supabase
    .from('payment_method_change_requests')
    .update({
      status: 'approved',
      reviewed_by: staffId,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', requestId);

  if (updError) throw new ApiError(500, `Failed to approve request: ${updError.message}`);

  try {
    await notificationService.createNotification(
      req.distributor_id,
      'system',
      'Payment Method Confirmed',
      `Your new payment number ${req.new_payment_account_number} has been confirmed and is now active.`,
      { requestId },
    );
  } catch {
    /* ignore */
  }
}

export async function rejectPaymentMethodChange(
  requestId: string,
  staffId: string,
  notes?: string,
): Promise<void> {
  const { data: req, error: fetchError } = await supabase
    .from('payment_method_change_requests')
    .select('*')
    .eq('id', requestId)
    .single();

  if (fetchError || !req) throw new ApiError(404, 'Change request not found');
  if (req.status !== 'pending') throw new ApiError(422, 'Request is not pending');

  const { error } = await supabase
    .from('payment_method_change_requests')
    .update({
      status: 'rejected',
      reviewed_by: staffId,
      reviewed_at: new Date().toISOString(),
      notes: notes || null,
    })
    .eq('id', requestId);

  if (error) throw new ApiError(500, `Failed to reject request: ${error.message}`);

  try {
    await notificationService.createNotification(
      req.distributor_id,
      'system',
      'Payment Method Change Rejected',
      'Your payment method change was rejected. Your previous number remains active.',
      { requestId },
    );
  } catch {
    /* ignore */
  }
}

export async function updatePhotoUrl(userId: string, photoUrl: string): Promise<{ photoUrl: string }> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('photo_url')
    .eq('id', userId)
    .single();

  const oldUrl = profile?.photo_url as string | null | undefined;

  const { error } = await supabase
    .from('profiles')
    .update({ photo_url: photoUrl })
    .eq('id', userId);

  if (error) throw new ApiError(500, `Failed to update photo: ${error.message}`);

  if (oldUrl && oldUrl !== photoUrl) {
    await deleteCloudinaryAsset(oldUrl);
  }

  return { photoUrl };
}
