import type { MobileMoneyProvider, PaymentMethod } from './payment';

export type OrderStatus =
  | 'pending_confirmation'
  | 'pending'
  | 'confirmed'
  | 'shipped'
  | 'delivered'
  | 'cancelled';

export interface OrderItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
}

export interface OrderPaymentDetails {
  method: PaymentMethod;
  reference?: string;
  provider?: MobileMoneyProvider;
  phone?: string;
}

export interface Order {
  id: string;
  distributorId: string;
  items: OrderItem[];
  total: number;
  currency: string;
  status: OrderStatus;
  country: string;
  payment: OrderPaymentDetails;
  createdAt: string;
}
