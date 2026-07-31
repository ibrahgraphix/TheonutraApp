export type DistributorRole = 'distributor' | 'admin' | 'company_staff';

export interface Distributor {
  id: string;
  distributorId: string;
  fullName: string;
  phone: string;
  role: DistributorRole;
  country: string;
  countryId?: string;
  currencyCode?: string;
  referredBy: string | null;
  joinDate: string;
  avatarUrl?: string;
  email?: string;
  isActive?: boolean;
  payment_method?: string;
  payment_full_name?: string;
  payment_account_number?: string;
}