import { z } from 'zod';

// No input schemas needed for referral endpoints
// validateReferralCode uses a URL parameter
// regenerateReferralCode uses a URL parameter
// getMyReferralInfo uses no input

export type ReferralInfo = {
  referral_code: string;
  referral_link: string;
};

export type ReferralValidation = {
  distributor_id: string;
  full_name: string;
  is_active: boolean;
};
