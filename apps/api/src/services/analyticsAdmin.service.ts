import { supabase } from '../config/supabase.js';
import { ApiError } from '../middleware/error.middleware.js';
import { convertToUSD } from '../config/exchangeRates.js';

export interface CompanyOverview {
  totalSales: number;
  totalSalesUSD: number;
  totalRevenue: number;
  activeMembers: number;
  inactiveMembers: number;
  newRegistrationsThisMonth: number;
  totalDistributors: number;
  currency: string;
}

export interface CountryPerformance {
  countryId: string;
  countryName: string;
  distributorCount: number;
  totalSales: number;
  totalSalesUSD: number;
  orderCount: number;
  currencyCode: string;
}

export interface ProductPerformance {
  productId: string;
  productName: string;
  unitsSold: number;
  totalRevenue: number;
  totalRevenueUSD: number;
}

/**
 * Returns high-level company-wide metrics for the CEO/staff dashboard.
 * "Sales" and "revenue" are the same figure here (sum of paid order totals) —
 * no separate cost/margin tracking exists yet to compute net revenue.
 * Staff only.
 */
export async function getCompanyOverview(): Promise<CompanyOverview> {
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();

  const { data: paidOrders, error: ordersError } = await supabase
    .from('orders')
    .select('total_amount, currency_code')
    .eq('status', 'paid');

  if (ordersError) {
    throw new ApiError(500, `Failed to fetch orders: ${ordersError.message}`);
  }

  // Also fetch customer sales for company overview
  const { data: customerSales, error: customerSalesError } = await supabase
    .from('customer_sales')
    .select('total_amount, currency_code');

  if (customerSalesError) {
    throw new ApiError(500, `Failed to fetch customer sales: ${customerSalesError.message}`);
  }

  // Properly convert all sales to USD for accurate company-wide totals
  let totalSales = 0;
  let totalSalesUSD = 0;
  
  // Process distributor orders
  for (const order of paidOrders ?? []) {
    const amount = Number(order.total_amount);
    const currency = order.currency_code || 'USD';
    totalSales += amount;
    totalSalesUSD += convertToUSD(amount, currency);
  }
  
  // Process customer sales
  for (const sale of customerSales ?? []) {
    const amount = Number(sale.total_amount);
    const currency = sale.currency_code || 'USD';
    totalSales += amount;
    totalSalesUSD += convertToUSD(amount, currency);
  }

  const { count: activeCount, error: activeError } = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true })
    .eq('is_active', true)
    .eq('role', 'distributor');

  if (activeError) {
    throw new ApiError(500, `Failed to count active members: ${activeError.message}`);
  }

  const { count: inactiveCount, error: inactiveError } = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true })
    .eq('is_active', false)
    .eq('role', 'distributor');

  if (inactiveError) {
    throw new ApiError(500, `Failed to count inactive members: ${inactiveError.message}`);
  }

  const { count: newRegs, error: newRegsError } = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true })
    .eq('role', 'distributor')
    .gte('created_at', monthStart);

  if (newRegsError) {
    throw new ApiError(500, `Failed to count new registrations: ${newRegsError.message}`);
  }

  const { count: totalDist, error: totalDistError } = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true })
    .eq('role', 'distributor');

  if (totalDistError) {
    throw new ApiError(500, `Failed to count total distributors: ${totalDistError.message}`);
  }

  return {
    totalSales,
    totalSalesUSD,
    totalRevenue: totalSales,
    activeMembers: activeCount ?? 0,
    inactiveMembers: inactiveCount ?? 0,
    newRegistrationsThisMonth: newRegs ?? 0,
    totalDistributors: totalDist ?? 0,
    currency: 'USD',
  };
}

/**
 * Returns per-country distributor counts and sales totals. Staff only.
 */
export async function getCountryPerformance(): Promise<CountryPerformance[]> {
  const { data: countries, error: countriesError } = await supabase
    .from('countries')
    .select('id, name, currency_code');

  if (countriesError) {
    throw new ApiError(500, `Failed to fetch countries: ${countriesError.message}`);
  }

  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('country_id')
    .eq('role', 'distributor');

  if (profilesError) {
    throw new ApiError(500, `Failed to fetch profiles: ${profilesError.message}`);
  }

  const { data: orders, error: ordersError } = await supabase
    .from('orders')
    .select('country_id, total_amount, status, currency_code');

  if (ordersError) {
    throw new ApiError(500, `Failed to fetch orders: ${ordersError.message}`);
  }

  // Also fetch customer sales for country performance
  const { data: customerSales, error: customerSalesError } = await supabase
    .from('customer_sales')
    .select('country_id, total_amount, currency_code');

  if (customerSalesError) {
    throw new ApiError(500, `Failed to fetch customer sales: ${customerSalesError.message}`);
  }

  const distributorCounts = new Map<string, number>();
  for (const p of profiles ?? []) {
    if (p.country_id) {
      distributorCounts.set(p.country_id, (distributorCounts.get(p.country_id) ?? 0) + 1);
    }
  }

  // Properly convert each country's sales to USD for comparison
  const salesByCountry = new Map<string, { total: number; totalUSD: number; count: number }>();
  
  // Process distributor orders
  for (const o of orders ?? []) {
    if (o.status !== 'paid') continue;
    const existing = salesByCountry.get(o.country_id) ?? { total: 0, totalUSD: 0, count: 0 };
    const amount = Number(o.total_amount);
    const orderCurrency = o.currency_code || 'USD';
    existing.total += amount;
    existing.totalUSD += convertToUSD(amount, orderCurrency);
    existing.count += 1;
    salesByCountry.set(o.country_id, existing);
  }
  
  // Process customer sales
  for (const sale of customerSales ?? []) {
    if (!sale.country_id) continue;
    const existing = salesByCountry.get(sale.country_id) ?? { total: 0, totalUSD: 0, count: 0 };
    const amount = Number(sale.total_amount);
    const saleCurrency = sale.currency_code || 'USD';
    existing.total += amount;
    existing.totalUSD += convertToUSD(amount, saleCurrency);
    existing.count += 1;
    salesByCountry.set(sale.country_id, existing);
  }

  return (countries ?? []).map((c) => {
    const salesData = salesByCountry.get(c.id);
    return {
      countryId: c.id,
      countryName: c.name,
      distributorCount: distributorCounts.get(c.id) ?? 0,
      totalSales: salesData?.total ?? 0,
      totalSalesUSD: salesData?.totalUSD ?? 0,
      orderCount: salesData?.count ?? 0,
      currencyCode: c.currency_code || 'USD',
    };
  });
}

/**
 * Returns per-product units sold and revenue, ranked by revenue descending.
 * Staff only.
 */
export async function getProductPerformance(): Promise<ProductPerformance[]> {
  const { data: orderItems, error } = await supabase
    .from('order_items')
    .select(`
      quantity,
      unit_price,
      product_id,
      products ( name ),
      orders!inner ( status, currency_code )
    `)
    .eq('orders.status', 'paid');

  if (error) {
    throw new ApiError(500, `Failed to fetch product performance: ${error.message}`);
  }

  // Properly convert each product's revenue to USD for comparison
  const productMap = new Map<string, { name: string; units: number; revenue: number; revenueUSD: number }>();

  for (const item of orderItems ?? []) {
    const productId = item.product_id as string;
    const productName = (item.products as any)?.name ?? 'Unknown Product';
    const quantity = Number(item.quantity);
    const revenue = quantity * Number(item.unit_price);
    const orderCurrency = (item.orders as any)?.currency_code || 'USD';
    const revenueUSD = convertToUSD(revenue, orderCurrency);

    const existing = productMap.get(productId) ?? { name: productName, units: 0, revenue: 0, revenueUSD: 0 };
    existing.units += quantity;
    existing.revenue += revenue;
    existing.revenueUSD += revenueUSD;
    productMap.set(productId, existing);
  }

  return Array.from(productMap.entries())
    .map(([productId, data]) => ({
      productId,
      productName: data.name,
      unitsSold: data.units,
      totalRevenue: data.revenue,
      totalRevenueUSD: data.revenueUSD,
    }))
    .sort((a, b) => b.totalRevenueUSD - a.totalRevenueUSD);
}