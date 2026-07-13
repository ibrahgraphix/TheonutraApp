import type { Distributor } from '../types';

export interface CreateSellerInput {
  fullName: string;
  phone: string;
  country: string;
  referredBy: string | null;
  distributorId: string;
  password: string;
}

export interface SellerCredentials {
  distributorId: string;
  password: string;
  fullName: string;
}

export interface DistributorWithCredentials extends Distributor {
  /** Returned only to staff after create/reset — not stored on Distributor type. */
  temporaryPassword?: string;
}
