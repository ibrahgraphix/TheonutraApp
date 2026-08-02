import { supabase } from '../config/supabase.js';
import { ApiError } from '../middleware/error.middleware.js';
import { listMyOrders } from './orders.service.js';
import { getCommissionsSummary } from './commissions.service.js';
import { convertToUSD, convertFromUSD } from '../config/exchangeRates.js';

export interface MonthlyOverview {
  month: string;
  label: string;
  personalSales: number;
  teamSales: number;
  bonusEarned: number;
  currency: string;
}

/**
 * Gets monthly overview for a distributor: personal sales, team sales, and bonus earned.
 * Defaults to current month if not specified.
 *
 * @param distributorId UUID of the distributor
 * @param month Optional month string in YYYY-MM format
 * @returns Monthly overview with personal sales, team sales, and bonus earned
 */
export async function getMonthlyOverview(distributorId: string, month?: string): Promise<MonthlyOverview> {
  // Default to current month if not provided
  const targetMonth = month || new Date().toISOString().slice(0, 7); // YYYY-MM

  // Calculate start and end of the month
  const startDate = new Date(`${targetMonth}-01`);
  const endDate = new Date(startDate);
  endDate.setMonth(endDate.getMonth() + 1); // First day of next month

  // Get distributor's country to determine currency
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('country_id, countries!inner(currency_code)')
    .eq('id', distributorId)
    .single();

  if (profileError || !profile) {
    throw new ApiError(404, 'Distributor profile not found');
  }

  const currency = (profile.countries as any)?.currency_code || 'USD';

  // 1. Personal sales this month - join with orders to get currency
  const { data: personalSalesData, error: personalError } = await supabase
    .from('sales')
    .select('amount, orders!inner(currency_code)')
    .eq('distributor_id', distributorId)
    .gte('sale_date', startDate.toISOString().slice(0, 10))
    .lt('sale_date', endDate.toISOString().slice(0, 10));

  if (personalError) {
    throw new ApiError(500, `Failed to fetch personal sales: ${personalError.message}`);
  }

  // Convert personal sales to user's currency
  let personalSales = (personalSalesData ?? []).reduce((sum, sale) => {
    const saleAmount = Number(sale.amount);
    const saleCurrency = (sale.orders as any)?.currency_code || 'USD';
    const amountInUSD = convertToUSD(saleAmount, saleCurrency);
    const amountInUserCurrency = convertFromUSD(amountInUSD, currency);
    return sum + amountInUserCurrency;
  }, 0);

  // Include customer (retail) sales logged by this distributor in the same period
  const { data: customerSalesData, error: customerSalesError } = await supabase
    .from('customer_sales')
    .select('total_amount, countries!inner(currency_code)')
    .eq('distributor_id', distributorId)
    .gte('created_at', startDate.toISOString())
    .lt('created_at', endDate.toISOString());

  if (customerSalesError) {
    throw new ApiError(500, `Failed to fetch personal customer sales: ${customerSalesError.message}`);
  }

  personalSales += (customerSalesData ?? []).reduce((sum, sale) => {
    const saleAmount = Number(sale.total_amount);
    const saleCurrency = (sale.countries as any)?.currency_code || currency;
    const amountInUSD = convertToUSD(saleAmount, saleCurrency);
    return sum + convertFromUSD(amountInUSD, currency);
  }, 0);

  // 2. Team sales this month (using downline_tree view to get member IDs, then aggregate sales)
  const { data: downlineRows, error: downlineError } = await supabase
    .from('downline_tree')
    .select('member_id')
    .eq('root_id', distributorId);

  if (downlineError) {
    throw new ApiError(500, `Failed to fetch team members: ${downlineError.message}`);
  }

  const memberIds = downlineRows?.map((r) => r.member_id as string) || [];

  let teamSales = 0;
  if (memberIds.length > 0) {
    const { data: teamSalesData, error: teamSalesError } = await supabase
      .from('sales')
      .select('amount, orders!inner(currency_code)')
      .in('distributor_id', memberIds)
      .gte('sale_date', startDate.toISOString().slice(0, 10))
      .lt('sale_date', endDate.toISOString().slice(0, 10));

    if (teamSalesError) {
      throw new ApiError(500, `Failed to fetch team sales: ${teamSalesError.message}`);
    }

    // Convert all team sales to user's currency
    teamSales = (teamSalesData ?? []).reduce((sum, sale) => {
      const saleAmount = Number(sale.amount);
      const saleCurrency = (sale.orders as any)?.currency_code || 'USD';
      const amountInUSD = convertToUSD(saleAmount, saleCurrency);
      const amountInUserCurrency = convertFromUSD(amountInUSD, currency);
      return sum + amountInUserCurrency;
    }, 0);
  }

  // 3. Bonus earned this month (reuse commissions service)
  const commissionSummary = await getCommissionsSummary(distributorId, targetMonth);

  // Format month label
  const monthLabel = new Date(`${targetMonth}-01`).toLocaleString('default', { month: 'long', year: 'numeric' });

  return {
    month: targetMonth,
    label: monthLabel,
    personalSales,
    teamSales,
    bonusEarned: commissionSummary.total_commission,
    currency,
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
export async function getOrderHistory(distributorId: string, page: number = 1, limit: number = 20) {
  return listMyOrders(distributorId, page, limit);
}
