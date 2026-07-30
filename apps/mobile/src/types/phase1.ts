//Phase1Types
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
  profiles?: {
    full_name: string;
    distributor_id: string;
  };
}

export interface SubmitKycInput {
  id_type: IdType;
  id_number: string;
  document_front_url: string;
  document_back_url?: string;
  selfie_url?: string;
}

export type WithdrawalMethod = 'bank' | 'mobile_money';
export type WithdrawalStatus = 'pending' | 'approved' | 'rejected' | 'paid';

export interface Transaction {
  id: string;
  beneficiary_id: string;
  type: string;
  amount: number;
  description?: string;
  source_type?: string;
  source_id?: string;
  created_at: string;
  bonus_type?: string;
  note?: string;
  category?: string;
}

export interface WalletBalance {
  balance: number;
  currency: string;
  recentTransactions: Transaction[];
}

export interface WithdrawalRequest {
  id: string;
  distributor_id: string;
  amount: number;
  method: WithdrawalMethod;
  payout_details: string;
  status: WithdrawalStatus;
  created_at: string;
  reviewed_by?: string;
  reviewed_at?: string;
  notes?: string;
  currencyCode?: string;
  profiles?: {
    full_name: string;
    distributor_id: string;
  };
}

export interface Rank {
  id: string;
  name: string;
  level_order: number;
  personal_pv_required: number;
  team_pv_required: number;
  description: string | null;
  reward_description: string | null;
  created_at: string;
}

export interface RankProgress {
  currentRank: Rank | null;
  personalPV: number;
  teamPV: number;
  nextRank: Rank | null;
  personalPVNeeded: number;
  teamPVNeeded: number;
}

export interface CustomerSaleItem {
  id: string;
  customerSaleId: string;
  productId: string;
  quantity: number;
  unitCustomerPrice: number;
  unitDistributorPrice: number;
  pvAtSale: number;
  productName?: string;
}

export interface CustomerSale {
  id: string;
  distributorId: string;
  customerName: string | null;
  customerPhone: string | null;
  countryId: string;
  totalAmount: number;
  totalPV: number;
  createdAt: string;
  items: CustomerSaleItem[];
}

export interface LogCustomerSaleInput {
  customerName?: string;
  customerPhone?: string;
  countryId: string;
  items: Array<{ productId: string; quantity: number }>;
}

export interface TeamBonusLevel {
  level: number;
  teamPV: number;
  teamSales: number;
  percentage: number;
  bonusAmount: number;
}

export interface TeamBonusSummary {
  distributorId: string;
  period: string;
  totalTeamPV: number;
  totalTeamSales: number;
  totalBonus: number;
  breakdown: TeamBonusLevel[];
}

export interface TeamBonusRate {
  id: string;
  rankId: string;
  rankName: string;
  level: number;
  percentage: number;
}

export interface ReferralInfo {
  referral_code: string;
  referral_link: string;
}

export interface Notification {
  id: string;
  distributor_id: string;
  type: string; // 'commission_earned' | 'team_bonus_earned' | 'withdrawal_status' | 'kyc_status' | 'new_referral' | 'manual_bonus' | 'system'
  title: string;
  message: string;
  is_read: boolean;
  data: any;
  created_at: string;
}

export interface TrainingCategory {
  id: string;
  name: string;
  description: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface TrainingMaterial {
  id: string;
  category_id: string;
  title: string;
  description: string | null;
  pdf_url: string;
  uploaded_by: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  category?: TrainingCategory;
  uploader?: {
    full_name: string;
    distributor_id: string;
  };
}

export type EventType = 'general' | 'health_education' | 'training' | 'product_launch';

export interface Event {
  id: string;
  title: string;
  description: string | null;
  event_type: EventType;
  location: string | null;
  is_online: boolean;
  meeting_note: string | null;
  start_at: string;
  end_at: string;
  banner_image_url: string | null;
  created_by: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type LoyaltyTransactionType = 'earn' | 'redeem' | 'adjustment';

export interface LoyaltyTransaction {
  id: string;
  distributor_id: string;
  type: LoyaltyTransactionType;
  source_type: string;
  source_id: string | null;
  points: number;
  balance_after: number;
  created_at: string;
}

export interface LoyaltyData {
  balance: number;
  history: {
    transactions: LoyaltyTransaction[];
    total: number;
    page: number;
    limit: number;
  };
}

export interface AuditLogEntry {
  id: string;
  actor_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  changes: any;
  created_at: string;
}
