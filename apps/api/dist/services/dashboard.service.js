/**
 * src/services/dashboard.service.ts
 *
 * Admin Dashboard Service for Step 10
 * Provides summary statistics and detailed views for the admin dashboard.
 */
import { supabase } from '../config/supabase.js';
import { ApiError } from '../middleware/error.middleware.js';
import { listPendingPayments } from './payments.service.js';
/**
 * Returns admin dashboard summary including:
 * - Pending payments count and list
 * - Active sellers count
 * - Total sales this month (company-wide)
 * - Total commissions paid this month (company-wide)
 */
export async function getAdminDashboardSummary() {
    // 1. Get pending payments (reuse existing function)
    const pendingPayments = await listPendingPayments();
    // 2. Get active sellers count (role = distributor and is_active = true)
    const { count: activeSellersCount, error: sellersError } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'distributor')
        .eq('is_active', true);
    if (sellersError) {
        throw new ApiError(500, `Failed to count active sellers: ${sellersError.message}`);
    }
    // 3. Get total sales this month (company-wide)
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const { data: salesData, error: salesError } = await supabase
        .from('sales')
        .select('amount')
        .gte('sale_date', startOfMonth.toISOString())
        .lt('sale_date', endOfMonth.toISOString());
    if (salesError) {
        throw new ApiError(500, `Failed to fetch sales this month: ${salesError.message}`);
    }
    const totalSalesThisMonth = salesData.reduce((sum, sale) => sum + Number(sale.amount), 0);
    // 4. Get total commissions paid this month (company-wide)
    const { data: commissionsData, error: commissionsError } = await supabase
        .from('commissions')
        .select('amount')
        .gte('created_at', startOfMonth.toISOString())
        .lt('created_at', endOfMonth.toISOString());
    if (commissionsError) {
        throw new ApiError(500, `Failed to fetch commissions this month: ${commissionsError.message}`);
    }
    const totalCommissionsPaidThisMonth = commissionsData.reduce((sum, commission) => sum + Number(commission.amount), 0);
    return {
        pendingPaymentsCount: pendingPayments.length,
        pendingPayments,
        activeSellersCount: activeSellersCount || 0,
        totalSalesThisMonth,
        totalCommissionsPaidThisMonth,
    };
}
/**
 * Returns detailed view for a single pending payment including:
 * - Payment details
 * - Order details
 * - Buyer information
 * - Order items (products, quantities, prices)
 */
export async function getPendingPaymentDetail(paymentId) {
    // 1. Fetch payment with order and buyer details
    const { data: paymentData, error: paymentError } = await supabase
        .from('payments')
        .select(`
      *,
      orders!inner (
        id,
        total_amount,
        status,
        created_at,
        profiles!inner (
          id,
          full_name,
          distributor_id,
          phone_number
        )
      )
    `)
        .eq('id', paymentId)
        .eq('is_confirmed', false)
        .single();
    if (paymentError || !paymentData) {
        throw new ApiError(404, 'Pending payment not found');
    }
    const payment = {
        id: paymentData.id,
        orderId: paymentData.order_id,
        method: paymentData.method,
        referenceNo: paymentData.reference_no,
        provider: paymentData.provider,
        phoneNumber: paymentData.phone_number,
        amount: Number(paymentData.amount),
        isConfirmed: paymentData.is_confirmed,
        confirmedBy: paymentData.confirmed_by,
        confirmedAt: paymentData.confirmed_at,
        createdAt: paymentData.created_at,
    };
    const order = paymentData.orders;
    const buyerProfile = order.profiles;
    const orderDetail = {
        id: order.id,
        totalAmount: Number(order.total_amount),
        status: order.status,
        createdAt: order.created_at,
    };
    const buyer = {
        id: buyerProfile.id,
        fullName: buyerProfile.full_name,
        distributorId: buyerProfile.distributor_id,
        phoneNumber: buyerProfile.phone_number,
    };
    // 2. Fetch order items with product details
    const { data: orderItems, error: itemsError } = await supabase
        .from('order_items')
        .select(`
      id,
      quantity,
      unit_price,
      products (
        name
      )
    `)
        .eq('order_id', order.id);
    if (itemsError) {
        throw new ApiError(500, `Failed to fetch order items: ${itemsError.message}`);
    }
    const items = (orderItems || []).map((item) => ({
        id: item.id,
        productName: item.products?.name || 'Unknown Product',
        quantity: item.quantity,
        unitPrice: Number(item.unit_price),
        totalPrice: Number(item.unit_price) * item.quantity,
    }));
    return {
        payment,
        order: orderDetail,
        buyer,
        orderItems: items,
    };
}
//# sourceMappingURL=dashboard.service.js.map