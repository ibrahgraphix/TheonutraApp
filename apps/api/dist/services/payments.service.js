//payments.services
import { supabase } from '../config/supabase.js';
import { ApiError } from '../middleware/error.middleware.js';
import { createSaleForOrder } from './commissions.service.js';
import * as notificationService from './notification.service.js';
/**
 * Validates that the order exists, belongs to the buyer, and is pending.
 */
async function validatePendingOrder(orderId, buyerId) {
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
export async function submitBankPayment(orderId, buyerId, referenceNo) {
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
        order_id: orderId,
        method: 'bank_transfer',
        reference_no: referenceNo,
        amount: amount,
        is_confirmed: false,
    })
        .select('*')
        .single();
    if (error || !data) {
        throw new ApiError(500, `Failed to submit bank payment: ${error?.message}`);
    }
    try {
        const { data: buyerProfile } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('id', buyerId)
            .maybeSingle();
        await notificationService.notifyPaymentSubmitted(orderId, buyerProfile?.full_name ?? 'A distributor', amount, 'bank_transfer');
    }
    catch (notifError) {
        console.error(`❌ Failed to send payment submitted notification: ${notifError}`);
    }
    return mapPayment(data);
}
/**
 * Submits a mobile money payment details.
 */
export async function submitMobileMoneyPayment(orderId, buyerId, provider, phoneNumber) {
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
        order_id: orderId,
        method: 'mobile_money',
        provider: provider,
        phone_number: phoneNumber,
        amount: amount,
        is_confirmed: false,
    })
        .select('*')
        .single();
    if (error || !data) {
        throw new ApiError(500, `Failed to submit mobile money payment: ${error?.message}`);
    }
    try {
        const { data: buyerProfile } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('id', buyerId)
            .maybeSingle();
        await notificationService.notifyPaymentSubmitted(orderId, buyerProfile?.full_name ?? 'A distributor', amount, 'mobile_money');
    }
    catch (notifError) {
        console.error(`❌ Failed to send payment submitted notification: ${notifError}`);
    }
    return mapPayment(data);
}
/**
 * Lists all unconfirmed payments, joined with order total and buyer profile.
 * Accessible to staff only.
 */
export async function listPendingPayments() {
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
    return (data ?? []).map((row) => {
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
export async function confirmPayment(paymentId, staffId) {
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
export async function rejectPayment(paymentId, staffId, _reason) {
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
function mapPayment(row) {
    return {
        id: row.id,
        orderId: row.order_id,
        method: row.method,
        referenceNo: row.reference_no,
        provider: row.provider,
        phoneNumber: row.phone_number,
        amount: Number(row.amount),
        isConfirmed: row.is_confirmed,
        confirmedBy: row.confirmed_by,
        confirmedAt: row.confirmed_at,
        createdAt: row.created_at,
    };
}
/**
 * Manually marks a "Pay Later" order as paid — used when a distributor
 * settled payment outside the bank/mobile-money flow (e.g. cash handoff)
 * and staff need to record it after the fact. Creates a confirmed payment
 * record directly, flips the order to 'paid', and triggers the same sale
 * creation logic normal payment confirmation does.
 * Staff only.
 */
export async function markOrderPaidManually(orderId, staffId, method = 'cash', note) {
    const { data: order, error: orderError } = await supabase
        .from('orders')
        .select('status, total_amount')
        .eq('id', orderId)
        .single();
    if (orderError || !order) {
        throw new ApiError(404, 'Order not found');
    }
    if (order.status !== 'pending') {
        throw new ApiError(422, `Cannot mark an order in '${order.status}' status as paid`);
    }
    const { data: existing } = await supabase
        .from('payments')
        .select('id')
        .eq('order_id', orderId)
        .maybeSingle();
    if (existing) {
        throw new ApiError(422, 'A payment record already exists for this order — use the normal confirm flow instead');
    }
    const { error: paymentError } = await supabase
        .from('payments')
        .insert({
        order_id: orderId,
        method,
        reference_no: note ?? 'Marked paid manually by staff',
        amount: Number(order.total_amount),
        is_confirmed: true,
        confirmed_by: staffId,
        confirmed_at: new Date().toISOString(),
    });
    if (paymentError) {
        throw new ApiError(500, `Failed to record manual payment: ${paymentError.message}`);
    }
    const { error: updateOrderError } = await supabase
        .from('orders')
        .update({ status: 'paid' })
        .eq('id', orderId);
    if (updateOrderError) {
        throw new ApiError(500, `Failed to update order status: ${updateOrderError.message}`);
    }
    await createSaleForOrder(orderId);
}
//# sourceMappingURL=payments.service.js.map