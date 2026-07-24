import { supabase } from '../config/supabase.js';
import { ApiError } from '../middleware/error.middleware.js';
import { env } from '../config/env.js';
import * as notificationService from './notification.service.js';
/**
 * Creates a sale row for the completed order.
 * This is called automatically when an order's payment is confirmed.
 *
 * @param orderId UUID of the confirmed order
 */
export async function createSaleForOrder(orderId) {
    // 1. Fetch order details (buyer and total amount)
    const { data: order, error: orderError } = await supabase
        .from('orders')
        .select('buyer_id, total_amount')
        .eq('id', orderId)
        .single();
    if (orderError || !order) {
        throw new ApiError(404, `Order not found during sale creation: ${orderError?.message}`);
    }
    // 2. Insert into the sales table
    const { error: saleError } = await supabase
        .from('sales')
        .insert({
        order_id: orderId,
        distributor_id: order.buyer_id,
        amount: order.total_amount,
    });
    if (saleError) {
        // If it's a unique constraint violation (already confirmed / sale exists), throw a specific error
        if (saleError.code === '23505') {
            throw new ApiError(409, 'A sale has already been recorded for this order');
        }
        throw new ApiError(500, `Failed to record sale: ${saleError.message}`);
    }
    console.log(`✅ Recorded sale for order ${orderId} (amount: ${order.total_amount})`);
    // ── Commission Distribution (Step 7) ───────────────────────────────────────
    // Look up the buyer's recruiter and create a commission for them (level 1 only)
    // 1. Fetch the buyer's referred_by from profiles
    const { data: buyerProfile, error: buyerError } = await supabase
        .from('profiles')
        .select('referred_by')
        .eq('id', order.buyer_id)
        .single();
    if (buyerError) {
        console.error(`❌ Failed to fetch buyer profile for commission: ${buyerError.message}`);
        // Don't throw - we don't want to break the sale creation if profile lookup fails
        // Log loudly for manual reconciliation
        return;
    }
    // 2. If buyer has no recruiter (top-level distributor), skip commission creation
    if (!buyerProfile?.referred_by) {
        console.log(`ℹ️ Buyer ${order.buyer_id} has no recruiter (referred_by is null) - no commission to pay`);
        return;
    }
    // 3. Fetch the created sale to get its ID
    const { data: sale, error: saleFetchError } = await supabase
        .from('sales')
        .select('id')
        .eq('order_id', orderId)
        .single();
    if (saleFetchError || !sale) {
        console.error(`❌ Failed to fetch created sale for commission: ${saleFetchError?.message}`);
        // This should not happen since we just inserted it, but log loudly if it does
        return;
    }
    // 4. Calculate commission amount
    const commissionAmount = order.total_amount * (env.COMMISSION_PERCENTAGE / 100);
    // 5. Insert commission for the recruiter (level 1)
    const { error: commissionError } = await supabase
        .from('commissions')
        .insert({
        sale_id: sale.id,
        beneficiary_id: buyerProfile.referred_by,
        level: 1,
        amount: commissionAmount,
    });
    if (commissionError) {
        console.error(`❌ FAILED TO CREATE COMMISSION for order ${orderId}: ${commissionError.message}`);
        console.error(`   Sale ID: ${sale.id}, Beneficiary: ${buyerProfile.referred_by}, Amount: ${commissionAmount}`);
        console.error(`   ⚠️ MANUAL RECONCILIATION REQUIRED - sale exists without commission`);
        // Don't throw - we don't want to break the sale creation, but log loudly
        return;
    }
    console.log(`✅ Commission created: ${commissionAmount} for beneficiary ${buyerProfile.referred_by} (level 1)`);
    // Send notification to the beneficiary
    try {
        await notificationService.notifyCommissionEarned(buyerProfile.referred_by, commissionAmount, sale.id);
    }
    catch (notifError) {
        console.error(`❌ Failed to send commission notification: ${notifError}`);
        // Don't throw - notification failure shouldn't break the commission
    }
}
/**
 * Get all commissions earned by a distributor, joined with sale details.
 * Used for the account/order-history-adjacent view.
 *
 * @param distributorId UUID of the distributor
 * @returns List of commissions with sale amount and date
 */
export async function getMyCommissions(distributorId) {
    const { data, error } = await supabase
        .from('commissions')
        .select(`
      id,
      level,
      amount,
      created_at,
      sales (
        id,
        amount,
        sale_date,
        order_id,
        distributor_id
      )
    `)
        .eq('beneficiary_id', distributorId)
        .order('created_at', { ascending: false });
    if (error) {
        throw new ApiError(500, `Failed to fetch commissions: ${error.message}`);
    }
    return data;
}
/**
 * Get total commission earned by a distributor in a given month.
 * Defaults to current month if not specified.
 *
 * @param distributorId UUID of the distributor
 * @param month Optional month string in YYYY-MM format
 * @returns Total commission amount for the month
 */
export async function getCommissionsSummary(distributorId, month) {
    // Default to current month if not provided
    const targetMonth = month || new Date().toISOString().slice(0, 7); // YYYY-MM
    // Calculate start and end of the month in JavaScript
    const startDate = new Date(`${targetMonth}-01`);
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + 1); // First day of next month
    const { data, error } = await supabase
        .from('commissions')
        .select('amount')
        .eq('beneficiary_id', distributorId)
        .gte('created_at', startDate.toISOString())
        .lt('created_at', endDate.toISOString());
    if (error) {
        throw new ApiError(500, `Failed to fetch commission summary: ${error.message}`);
    }
    const total = data.reduce((sum, commission) => sum + Number(commission.amount), 0);
    return {
        month: targetMonth,
        total_commission: total,
        commission_count: data.length,
    };
}
//# sourceMappingURL=commissions.service.js.map