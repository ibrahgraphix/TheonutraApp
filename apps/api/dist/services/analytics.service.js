import { supabase } from '../config/supabase.js';
import { ApiError } from '../middleware/error.middleware.js';
import { listMyOrders } from './orders.service.js';
import { getCommissionsSummary } from './commissions.service.js';
/**
 * Gets monthly overview for a distributor: personal sales, team sales, and bonus earned.
 * Defaults to current month if not specified.
 *
 * @param distributorId UUID of the distributor
 * @param month Optional month string in YYYY-MM format
 * @returns Monthly overview with personal sales, team sales, and bonus earned
 */
export async function getMonthlyOverview(distributorId, month) {
    // Default to current month if not provided
    const targetMonth = month || new Date().toISOString().slice(0, 7); // YYYY-MM
    // Calculate start and end of the month
    const startDate = new Date(`${targetMonth}-01`);
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + 1); // First day of next month
    // 1. Personal sales this month
    const { data: personalSalesData, error: personalError } = await supabase
        .from('sales')
        .select('amount')
        .eq('distributor_id', distributorId)
        .gte('sale_date', startDate.toISOString().slice(0, 10))
        .lt('sale_date', endDate.toISOString().slice(0, 10));
    if (personalError) {
        throw new ApiError(500, `Failed to fetch personal sales: ${personalError.message}`);
    }
    const personalSales = personalSalesData?.reduce((sum, sale) => sum + Number(sale.amount), 0) || 0;
    // 2. Team sales this month (using downline_tree view to get member IDs, then aggregate sales)
    const { data: downlineRows, error: downlineError } = await supabase
        .from('downline_tree')
        .select('member_id')
        .eq('root_id', distributorId);
    if (downlineError) {
        throw new ApiError(500, `Failed to fetch team members: ${downlineError.message}`);
    }
    const memberIds = downlineRows?.map((r) => r.member_id) || [];
    let teamSales = 0;
    if (memberIds.length > 0) {
        const { data: teamSalesData, error: teamSalesError } = await supabase
            .from('sales')
            .select('amount')
            .in('distributor_id', memberIds)
            .gte('sale_date', startDate.toISOString().slice(0, 10))
            .lt('sale_date', endDate.toISOString().slice(0, 10));
        if (teamSalesError) {
            throw new ApiError(500, `Failed to fetch team sales: ${teamSalesError.message}`);
        }
        teamSales = teamSalesData?.reduce((sum, sale) => sum + Number(sale.amount), 0) || 0;
    }
    // 3. Bonus earned this month (reuse commissions service)
    const commissionSummary = await getCommissionsSummary(distributorId, targetMonth);
    return {
        month: targetMonth,
        personalSales,
        teamSales,
        bonusEarned: commissionSummary.total_commission,
    };
}
/**
 * Gets order history for a distributor with pagination.
 * Wraps orders.service.listMyOrders with pagination params.
 *
 * @param distributorId UUID of the distributor
 * @param page Page number (default 1)
 * @param limit Items per page (default 20)
 * @returns Paginated order history
 */
export async function getOrderHistory(distributorId, page = 1, limit = 20) {
    return listMyOrders(distributorId, page, limit);
}
//# sourceMappingURL=analytics.service.js.map