export type CommissionType = 'personal' | 'team' | 'bonus' | 'referral';

export interface Commission {
  id: string;
  distributorId: string;
  amount: number;
  currency: string;
  type: CommissionType;
  period: string;
  description: string;
  createdAt: string;
}
