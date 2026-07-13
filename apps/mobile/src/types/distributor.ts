export type DistributorRole = 'distributor' | 'admin' | 'company_staff';

export interface Distributor {
  id: string;
  distributorId: string;
  fullName: string;
  phone: string;
  role: DistributorRole;
  country: string;
  referredBy: string | null;
  joinDate: string;
  avatarUrl?: string;
  email?: string;
}
