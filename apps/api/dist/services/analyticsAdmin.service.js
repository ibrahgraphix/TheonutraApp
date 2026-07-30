import { supabase } from '../config/supabase.js';
import { ApiError } from '../middleware/error.middleware.js';
/**
 * Returns high-level company-wide metrics for the CEO/staff dashboard.
 * "Sales" and "revenue" are the same figure here (sum of paid order totals) —
 * no separate cost/margin tracking exists yet to compute net revenue.
 * Staff only.
 */
export async function getCompanyOverview() {
    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
    const { data: paidOrders, error: ordersError } = await supabase
        .from('orders')
        .select('total_amount, currency_code')
        .eq('status', 'paid');
    if (ordersError) {
        throw new ApiError(500, `Failed to fetch orders: ${ordersError.message}`);
    }
    const totalSales = (paidOrders ?? []).reduce((sum, o) => sum + Number(o.total_amount), 0);
    const currency = paidOrders?.[0]?.currency_code ?? 'USD';
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
        totalRevenue: totalSales,
        activeMembers: activeCount ?? 0,
        inactiveMembers: inactiveCount ?? 0,
        newRegistrationsThisMonth: newRegs ?? 0,
        totalDistributors: totalDist ?? 0,
        currency,
    };
}
/**
 * Returns per-country distributor counts and sales totals. Staff only.
 */
export async function getCountryPerformance() {
    const { data: countries, error: countriesError } = await supabase
        .from('countries')
        .select('id, name');
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
        .select('country_id, total_amount, status');
    if (ordersError) {
        throw new ApiError(500, `Failed to fetch orders: ${ordersError.message}`);
    }
    const distributorCounts = new Map();
    for (const p of profiles ?? []) {
        if (p.country_id) {
            distributorCounts.set(p.country_id, (distributorCounts.get(p.country_id) ?? 0) + 1);
        }
    }
    const salesByCountry = new Map();
    for (const o of orders ?? []) {
        if (o.status !== 'paid')
            continue;
        const existing = salesByCountry.get(o.country_id) ?? { total: 0, count: 0 };
        existing.total += Number(o.total_amount);
        existing.count += 1;
        salesByCountry.set(o.country_id, existing);
    }
    return (countries ?? []).map((c) => ({
        countryId: c.id,
        countryName: c.name,
        distributorCount: distributorCounts.get(c.id) ?? 0,
        totalSales: salesByCountry.get(c.id)?.total ?? 0,
        orderCount: salesByCountry.get(c.id)?.count ?? 0,
    }));
}
/**
 * Returns per-product units sold and revenue, ranked by revenue descending.
 * Staff only.
 */
export async function getProductPerformance() {
    const { data: orderItems, error } = await supabase
        .from('order_items')
        .select(`
      quantity,
      unit_price,
      product_id,
      products ( name ),
      orders!inner ( status )
    `)
        .eq('orders.status', 'paid');
    if (error) {
        throw new ApiError(500, `Failed to fetch product performance: ${error.message}`);
    }
    const productMap = new Map();
    for (const item of orderItems ?? []) {
        const productId = item.product_id;
        const productName = item.products?.name ?? 'Unknown Product';
        const quantity = Number(item.quantity);
        const revenue = quantity * Number(item.unit_price);
        const existing = productMap.get(productId) ?? { name: productName, units: 0, revenue: 0 };
        existing.units += quantity;
        existing.revenue += revenue;
        productMap.set(productId, existing);
    }
    return Array.from(productMap.entries())
        .map(([productId, data]) => ({
        productId,
        productName: data.name,
        unitsSold: data.units,
        totalRevenue: data.revenue,
    }))
        .sort((a, b) => b.totalRevenue - a.totalRevenue);
}
//# sourceMappingURL=analyticsAdmin.service.js.map