export type PaymentStatus = 'pending' | 'completed' | 'failed';

export type PaymentMethod = 'bank_transfer' | 'mobile_money';

export type MobileMoneyProvider = 'M-Pesa' | 'Tigo Pesa' | 'Airtel Money' | 'Mixx by Yas';

export interface Payment {
  id: string;
  orderId: string;
  distributorId: string;
  amount: number;
  currency: string;
  method: PaymentMethod;
  status: PaymentStatus;
  reference?: string;
  provider?: MobileMoneyProvider;
  phone?: string;
  createdAt: string;
}

export interface CompanyBankDetails {
  bankName: string;
  accountName: string;
  accountNumber: string;
  branchCode: string;
  swiftCode: string;
}
