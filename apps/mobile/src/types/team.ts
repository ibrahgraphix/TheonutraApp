import type { Distributor } from './distributor';

export interface TeamMember {
  distributor: Distributor;
  level: number;
  personalSales: number;
  teamSales: number;
  recruitsCount: number;
  children: TeamMember[];
}

export interface DashboardStats {
  personalSales: number;
  teamSales: number;
  bonusEarned: number;
  currency: string;
  period: string;
}

export interface MonthlyAnalysis {
  month: string;
  label: string;
  personalSales: number;
  teamSales: number;
  bonusEarned: number;
  currency: string;
}
