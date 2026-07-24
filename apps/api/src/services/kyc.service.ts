import { supabase } from '../config/supabase.js';
import { ApiError } from '../middleware/error.middleware.js';
import * as notificationService from './notification.service.js';
import * as auditLogService from './auditLog.service.js';

export type KycStatus = 'not_submitted' | 'pending' | 'approved' | 'rejected' | 'resubmit_required';

export type IdType = 'national_id' | 'passport' | 'voter_id' | 'driver_license';

export interface KycSubmission {
  id: string;
  distributor_id: string;
  id_type: IdType;
  id_number: string;
  document_front_url: string;
  document_back_url: string | null;
  selfie_url: string | null;
  status: KycStatus;
  submitted_at: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  rejection_reason: string | null;
}

export interface SubmitKycInput {
  id_type: IdType;
  id_number: string;
  document_front_url: string;
  document_back_url?: string;
  selfie_url?: string;
}

export interface ReviewKycInput {
  decision: 'approve' | 'reject' | 'request_resubmission';
  reason?: string;
}

/**
 * Submits or updates a KYC submission for a distributor.
 * Creates a new submission with status 'pending' and updates the denormalized kyc_status on profiles.
 */
export async function submitKyc(
  distributorId: string,
  data: SubmitKycInput,
): Promise<KycSubmission> {
  // Check if there's an existing submission that's not approved
  const { data: existing, error: checkError } = await supabase
    .from('kyc_submissions')
    .select('id, status')
    .eq('distributor_id', distributorId)
    .order('submitted_at', { ascending: false })
    .limit(1);

  if (checkError) {
    throw new ApiError(500, `Failed to check existing KYC submission: ${checkError.message}`);
  }

  // If there's an existing approved submission, don't allow resubmission
  if (existing && existing.length > 0 && existing[0].status === 'approved') {
    throw new ApiError(400, 'KYC is already approved. No resubmission needed.');
  }

  // Insert new submission
  const { data: submission, error: insertError } = await supabase
    .from('kyc_submissions')
    .insert({
      distributor_id: distributorId,
      id_type: data.id_type,
      id_number: data.id_number,
      document_front_url: data.document_front_url,
      document_back_url: data.document_back_url || null,
      selfie_url: data.selfie_url || null,
      status: 'pending',
    })
    .select()
    .single();

  if (insertError) {
    throw new ApiError(500, `Failed to submit KYC: ${insertError.message}`);
  }

  return submission as KycSubmission;
}

/**
 * Reviews a KYC submission (staff only).
 * Updates both kyc_submissions and the denormalized kyc_status on profiles.
 */
export async function reviewKyc(
  staffId: string,
  submissionId: string,
  data: ReviewKycInput,
): Promise<void> {
  // Fetch the submission to get distributor_id
  const { data: submission, error: fetchError } = await supabase
    .from('kyc_submissions')
    .select('id, distributor_id, status')
    .eq('id', submissionId)
    .single();

  if (fetchError || !submission) {
    throw new ApiError(404, 'KYC submission not found');
  }

  if (submission.status !== 'pending') {
    throw new ApiError(400, 'KYC submission is not in pending status');
  }

  // Determine new status based on decision
  let newStatus: KycStatus;
  switch (data.decision) {
    case 'approve':
      newStatus = 'approved';
      break;
    case 'reject':
      newStatus = 'rejected';
      break;
    case 'request_resubmission':
      newStatus = 'resubmit_required';
      break;
    default:
      throw new ApiError(400, 'Invalid decision');
  }

  // Update submission
  const { error: updateError } = await supabase
    .from('kyc_submissions')
    .update({
      status: newStatus,
      reviewed_by: staffId,
      reviewed_at: new Date().toISOString(),
      rejection_reason: data.reason || null,
    })
    .eq('id', submissionId);

  if (updateError) {
    throw new ApiError(500, `Failed to review KYC: ${updateError.message}`);
  }

  // The trigger will automatically update the denormalized kyc_status on profiles

  // Log audit action
  await auditLogService.logAction(
    staffId,
    `kyc_${data.decision}`,
    'kyc_submission',
    submissionId,
    {
      distributor_id: submission.distributor_id,
      previous_status: 'pending',
      new_status: newStatus,
      reason: data.reason || null,
    },
  );

  // Send notification
  try {
    await notificationService.notifyKycStatus(
      submission.distributor_id,
      newStatus,
      data.reason,
    );
  } catch (notifError) {
    console.error(`❌ Failed to send KYC status notification: ${notifError}`);
    // Don't throw - notification failure shouldn't break the review
  }
}

/**
 * Gets the KYC status for a distributor (from the denormalized field on profiles).
 */
export async function getMyKycStatus(distributorId: string): Promise<{ status: KycStatus }> {
  const { data: profile, error: fetchError } = await supabase
    .from('profiles')
    .select('kyc_status')
    .eq('id', distributorId)
    .single();

  if (fetchError || !profile) {
    throw new ApiError(404, 'Profile not found');
  }

  return {
    status: profile.kyc_status as KycStatus,
  };
}

/**
 * Gets the full KYC submission details for a distributor.
 */
export async function getMyKycSubmission(distributorId: string): Promise<KycSubmission | null> {
  const { data, error } = await supabase
    .from('kyc_submissions')
    .select('*')
    .eq('distributor_id', distributorId)
    .order('submitted_at', { ascending: false })
    .limit(1);

  if (error) {
    throw new ApiError(500, `Failed to fetch KYC submission: ${error.message}`);
  }

  if (!data || data.length === 0) {
    return null;
  }

  return data[0] as KycSubmission;
}

/**
 * Lists all pending KYC submissions (staff only).
 */
export async function listPendingKyc(
  page: number = 1,
  limit: number = 20,
): Promise<{ submissions: KycSubmission[]; total: number; page: number; limit: number }> {
  const offset = (page - 1) * limit;

  // Get total count
  const { count, error: countError } = await supabase
    .from('kyc_submissions')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending');

  if (countError) {
    throw new ApiError(500, `Failed to count pending KYC submissions: ${countError.message}`);
  }

  // Get paginated submissions with distributor info
  const { data, error } = await supabase
    .from('kyc_submissions')
    .select(`
      *,
      profiles!kyc_submissions_distributor_id_fkey (
        full_name,
        distributor_id
      )
    `)
    .eq('status', 'pending')
    .order('submitted_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    throw new ApiError(500, `Failed to fetch pending KYC submissions: ${error.message}`);
  }

  const submissions = (data ?? []).map((row: any) => ({
    ...row,
    profiles: row.profiles ? {
      full_name: row.profiles.full_name,
      distributor_id: row.profiles.distributor_id,
    } : undefined,
  })) as any[];

  return {
    submissions,
    total: count ?? 0,
    page,
    limit,
  };
}

/**
 * Gets a specific KYC submission by ID (staff only).
 */
export async function getKycSubmissionById(submissionId: string): Promise<KycSubmission> {
  const { data, error } = await supabase
    .from('kyc_submissions')
    .select(`
      *,
      profiles!kyc_submissions_distributor_id_fkey (
        full_name,
        distributor_id
      )
    `)
    .eq('id', submissionId)
    .single();

  if (error || !data) {
    throw new ApiError(404, 'KYC submission not found');
  }

  const submission = data as any;
  submission.profiles = data.profiles ? {
    full_name: data.profiles.full_name,
    distributor_id: data.profiles.distributor_id,
  } : undefined;

  return submission;
}
