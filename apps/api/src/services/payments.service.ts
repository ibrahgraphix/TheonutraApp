import { supabase } from '../config/supabase.js';
import { ApiError } from '../middleware/error.middleware.js';
import { createSaleForOrder } from './commissions.service.js';

export interface Payment {
  id:          string;
  orderId:     string;
  method:      string;
  referenceNo: string | null;
  provider:    string | null;
  phoneNumber: string | null;
  amount:      number;
  isConfirmed: boolean;
  confirmedBy: string | null;
  confirmedAt: string | null;
  createdAt:   string;
  // joined fields
  orderTotal?: number;
  buyerName?:  string;
  distributorId?: string;
}

/**
 * Validates that the order exists, belongs to the buyer, and is pending.
 */
async function validatePendingOrder(orderId: string, buyerId: string): Promise<number> {
  const { data: order, error } = await supabase
    .from('orders')
    .select('buyer_id, status, total_amount')
    .eq('id', orderId)
    .single();

  if (error || !order) {
    throw new ApiError(404, 'Order not found');
  }

  if (order.buyer_id !== buyerId) {
    throw new ApiError(403, 'You do not own this order');
  }

  if (order.status !== 'pending') {
    throw new ApiError(422, `Cannot pay for an order in '${order.status}' status`);
  }

  return Number(order.total_amount);
}

/**
 * Submits a bank payment slip reference for an order.
 */
export async function submitBankPayment(
  orderId: string,
  buyerId: string,
  referenceNo: string,
): Promise<Payment> {
  const amount = await validatePendingOrder(orderId, buyerId);

  // Check if a payment reference for this order already exists
  const { data: existing } = await supabase
    .from('payments')
    .select('id')
    .eq('order_id', orderId)
    .maybeSingle();

  if (existing) {
    throw new ApiError(422, 'Payment reference already submitted for this order');
  }

  const { data, error } = await supabase
    .from('payments')
    .insert({
      order_id:     orderId,
      method:       'bank_transfer',
      reference_no: referenceNo,
      amount:       amount,
      is_confirmed: false,
    })
    .select('*')
    .single();

  if (error || !data) {
    throw new ApiError(500, `Failed to submit bank payment: ${error?.message}`);
  }

  return mapPayment(data);
}

/**
 * Submits a mobile money payment details.
 */
export async function submitMobileMoneyPayment(
  orderId: string,
  buyerId: string,
  provider: string,
  phoneNumber: string,
): Promise<Payment> {
  const amount = await validatePendingOrder(orderId, buyerId);

  // Check if a payment for this order already exists
  const { data: existing } = await supabase
    .from('payments')
    .select('id')
    .eq('order_id', orderId)
    .maybeSingle();

  if (existing) {
    throw new ApiError(422, 'Payment details already submitted for this order');
  }

  const { data, error } = await supabase
    .from('payments')
    .insert({
      order_id:     orderId,
      method:       'mobile_money',
      provider:     provider,
      phone_number: phoneNumber,
      amount:       amount,
      is_confirmed: false,
    })
    .select('*')
    .single();

  if (error || !data) {
    throw new ApiError(500, `Failed to submit mobile money payment: ${error?.message}`);
  }

  return mapPayment(data);
}

/**
 * Lists all unconfirmed payments, joined with order total and buyer profile.
 * Accessible to staff only.
 */
export async function listPendingPayments(): Promise<Payment[]> {
  const { data, error } = await supabase
    .from('payments')
    .select(`
      *,
      orders!inner (
        total_amount,
        profiles!inner (
          full_name,
          distributor_id
        )
      )
    `)
    .eq('is_confirmed', false)
    .order('created_at', { ascending: true });

  if (error) {
    throw new ApiError(500, `Failed to list pending payments: ${error.message}`);
  }

  return (data ?? []).map((row: any) => {
    const payment = mapPayment(row);
    const order = row.orders;
    if (order) {
      payment.orderTotal = Number(order.total_amount);
      const profile = order.profiles;
      if (profile) {
        payment.buyerName = profile.full_name;
        payment.distributorId = profile.distributor_id;
      }
    }
    return payment;
  });
}

/**
 * Confirms a payment. Flips order to paid and creates a sales record.
 * Accessible to staff only.
 */
export async function confirmPayment(
  paymentId: string,
  staffId: string,
): Promise<void> {
  // 1. Fetch payment to make sure it exists, get order_id
  const { data: payment, error } = await supabase
    .from('payments')
    .select('order_id, is_confirmed')
    .eq('id', paymentId)
    .single();

  if (error || !payment) {
    throw new ApiError(404, 'Payment record not found');
  }

  if (payment.is_confirmed) {
    throw new ApiError(422, 'Payment has already been confirmed');
  }

  // 2. Mark payment confirmed
  const { error: updatePaymentError } = await supabase
    .from('payments')
    .update({
      is_confirmed: true,
      confirmed_by: staffId,
      confirmed_at: new Date().toISOString(),
    })
    .eq('id', paymentId);

  if (updatePaymentError) {
    throw new ApiError(500, `Failed to confirm payment: ${updatePaymentError.message}`);
  }

  // 3. Mark parent order paid
  const { error: updateOrderError } = await supabase
    .from('orders')
    .update({ status: 'paid' })
    .eq('id', payment.order_id);

  if (updateOrderError) {
    throw new ApiError(500, `Failed to update order status: ${updateOrderError.message}`);
  }

  // 4. Trigger sale record (which will eventually compute commissions in Step 7)
  await createSaleForOrder(payment.order_id);
}

/**
 * Rejects a payment. Marks order as cancelled.
 * Accessible to staff only.
 */
export async function rejectPayment(
  paymentId: string,
  staffId: string,
  _reason?: string,
): Promise<void> {
  // Fetch payment to get order_id
  const { data: payment, error } = await supabase
    .from('payments')
    .select('order_id, is_confirmed')
    .eq('id', paymentId)
    .single();

  if (error || !payment) {
    throw new ApiError(404, 'Payment record not found');
  }

  if (payment.is_confirmed) {
    throw new ApiError(422, 'Cannot reject an already confirmed payment');
  }

  // Check parent order status first to ensure we don't overwrite completed orders
  const { data: order, error: orderErr } = await supabase
    .from('orders')
    .select('status')
    .eq('id', payment.order_id)
    .single();

  if (orderErr || !order) {
    throw new ApiError(404, 'Order not found');
  }

  if (order.status !== 'pending') {
    throw new ApiError(422, `Cannot cancel an order in status '${order.status}'`);
  }

  // Update order status to cancelled
  const { error: updateOrderError } = await supabase
    .from('orders')
    .update({ status: 'cancelled' })
    .eq('id', payment.order_id);

  if (updateOrderError) {
    throw new ApiError(500, `Failed to cancel order: ${updateOrderError.message}`);
  }

  // Optionally mark payment details or keep it unconfirmed.
  // The prompt says: "mark the payment as not confirmed but the order as 'cancelled' (simple version — no partial refund logic needed yet)"
  // So we leave `is_confirmed = false` on the payment, but we can set confirmed_by/confirmed_at or note it if we want.
  // Let's also stamp confirmed_by/confirmed_at to track who rejected it?
  // Let's keep it simple as requested: keep it unconfirmed (is_confirmed: false) but set order as cancelled.
}

// ── Private helpers ──────────────────────────────────────────────────────────

function mapPayment(row: Record<string, any>): Payment {
  return {
    id:          row.id as string,
    orderId:     row.order_id as string,
    method:      row.method as string,
    referenceNo: row.reference_no as string | null,
    provider:    row.provider as string | null,
    phoneNumber: row.phone_number as string | null,
    amount:      Number(row.amount),
    isConfirmed: row.is_confirmed as boolean,
    confirmedBy: row.confirmed_by as string | null,
    confirmedAt: row.confirmed_at as string | null,
    createdAt:   row.created_at as string,
  };
}
