import { supabase } from '../config/supabase.js';
import { ApiError } from '../middleware/error.middleware.js';
import { LogCustomerSaleInput } from '../schemas/customerSales.schema.js';

export interface CustomerSaleItem {
  id: string;
  customerSaleId: string;
  productId: string;
  quantity: number;
  unitCustomerPrice: number;
  unitDistributorPrice: number;
  pvAtSale: number;
  productName?: string;
}

export interface CustomerSale {
  id: string;
  distributorId: string;
  customerName: string | null;
  customerPhone: string | null;
  countryId: string;
  totalAmount: number;
  totalPV: number;
  createdAt: string;
  items: CustomerSaleItem[];
}

export interface CustomerSalesSummary {
  totalRetailProfit: number;
  totalPV: number;
}

/**
 * Logs a customer sale for a distributor.
 * Snapshots prices and PV at time of sale, creates customer_sale_items,
 * and creates a retail_profit commission entry.
 */
export async function logCustomerSale(
  distributorId: string,
  input: LogCustomerSaleInput,
): Promise<CustomerSale> {
  // 1. Look up product prices and PV for all items
  const productIds = input.items.map((item) => item.productId);
  
  const { data: products, error: productsError } = await supabase
    .from('products')
    .select(`
      id,
      pv,
      product_prices!inner (
        price,
        distributor_price,
        country_id
      )
    `)
    .in('id', productIds)
    .eq('product_prices.country_id', input.countryId);

  if (productsError) {
    throw new ApiError(500, `Failed to fetch product data: ${productsError.message}`);
  }

  if (!products || products.length === 0) {
    throw new ApiError(404, 'Products not found or not available in the specified country');
  }

  const productMap = new Map(
    products.map((p) => [
      p.id,
      {
        pv: Number(p.pv ?? 0),
        price: (p.product_prices as any[])[0]?.price,
        distributorPrice: (p.product_prices as any[])[0]?.distributor_price,
      },
    ]),
  );

  // 2. Validate all items have price data
  for (const item of input.items) {
    const productData = productMap.get(item.productId);
    if (!productData || productData.price === undefined || productData.distributorPrice === undefined) {
      throw new ApiError(400, `Product ${item.productId} does not have pricing data for the specified country`);
    }
  }

  // 3. Calculate totals
  let totalAmount = 0;
  let totalPV = 0;
  let totalRetailProfit = 0;

  const itemData = input.items.map((item) => {
    const productData = productMap.get(item.productId)!;
    const itemTotal = item.quantity * productData.price;
    const itemPV = item.quantity * productData.pv;
    const itemProfit = item.quantity * (productData.price - productData.distributorPrice);

    totalAmount += itemTotal;
    totalPV += itemPV;
    totalRetailProfit += itemProfit;

    return {
      productId: item.productId,
      quantity: item.quantity,
      unitCustomerPrice: productData.price,
      unitDistributorPrice: productData.distributorPrice,
      pvAtSale: productData.pv,
    };
  });

  // 4. Insert customer_sale
  const { data: customerSale, error: saleError } = await supabase
    .from('customer_sales')
    .insert({
      distributor_id: distributorId,
      customer_name: input.customerName ?? null,
      customer_phone: input.customerPhone ?? null,
      country_id: input.countryId,
      total_amount: totalAmount,
      total_pv: totalPV,
    })
    .select('id, distributor_id, customer_name, customer_phone, country_id, total_amount, total_pv, created_at')
    .single();

  if (saleError || !customerSale) {
    throw new ApiError(500, `Failed to create customer sale: ${saleError?.message}`);
  }

  // 5. Insert customer_sale_items
  const saleItemRows = itemData.map((item) => ({
    customer_sale_id: customerSale.id,
    product_id: item.productId,
    quantity: item.quantity,
    unit_customer_price: item.unitCustomerPrice,
    unit_distributor_price: item.unitDistributorPrice,
    pv_at_sale: item.pvAtSale,
  }));

  const { error: itemsError } = await supabase
    .from('customer_sale_items')
    .insert(saleItemRows);

  if (itemsError) {
    // Rollback: delete the customer sale
    await supabase.from('customer_sales').delete().eq('id', customerSale.id);
    throw new ApiError(500, `Failed to create customer sale items: ${itemsError.message}`);
  }

  // 6. Insert retail_profit commission (immediate earn — not staff-approve network bonus)
  const { data: commission, error: commissionError } = await supabase
    .from('commissions')
    .insert({
      beneficiary_id: distributorId,
      type: 'retail_profit',
      amount: totalRetailProfit,
      source_id: customerSale.id,
      source_type: 'customer_sale',
      status: 'approved',
      approved_at: new Date().toISOString(),
    })
    .select('id')
    .single();

  if (commissionError || !commission) {
    await supabase.from('customer_sale_items').delete().eq('customer_sale_id', customerSale.id);
    await supabase.from('customer_sales').delete().eq('id', customerSale.id);
    throw new ApiError(500, `Failed to create retail profit commission: ${commissionError?.message}`);
  }

  // 7. Credit wallet immediately (retail profit is outside the network PV engine)
  if (totalRetailProfit > 0) {
    const { data: wallet } = await supabase
      .from('wallets')
      .select('balance')
      .eq('distributor_id', distributorId)
      .maybeSingle();

    const newBalance = Number(wallet?.balance ?? 0) + totalRetailProfit;
    const { error: walletError } = await supabase
      .from('wallets')
      .upsert(
        { distributor_id: distributorId, balance: newBalance },
        { onConflict: 'distributor_id' },
      );

    if (walletError) {
      console.error(`Failed to upsert wallet for retail profit: ${walletError.message}`);
    } else {
      const { error: txError } = await supabase.from('wallet_transactions').insert({
        distributor_id: distributorId,
        type: 'credit',
        source_type: 'commission',
        source_id: commission.id,
        amount: totalRetailProfit,
        balance_after: newBalance,
      });
      if (txError) {
        console.error(`Failed to insert wallet transaction for retail profit: ${txError.message}`);
        throw new ApiError(500, `Failed to credit wallet for retail profit: ${txError.message}`);
      }
    }
  }

  // 8. Fetch the created items for response with product names
  const { data: createdItems, error: fetchItemsError } = await supabase
    .from('customer_sale_items')
    .select(`
      *,
      products!inner (
        name
      )
    `)
    .eq('customer_sale_id', customerSale.id);

  if (fetchItemsError) {
    throw new ApiError(500, `Failed to fetch customer sale items: ${fetchItemsError.message}`);
  }

  return {
    id: customerSale.id,
    distributorId: customerSale.distributor_id,
    customerName: customerSale.customer_name,
    customerPhone: customerSale.customer_phone,
    countryId: customerSale.country_id,
    totalAmount: Number(customerSale.total_amount),
    totalPV: Number(customerSale.total_pv),
    createdAt: customerSale.created_at,
    items: (createdItems ?? []).map((item) => ({
      id: item.id,
      customerSaleId: item.customer_sale_id,
      productId: item.product_id,
      quantity: Number(item.quantity),
      unitCustomerPrice: Number(item.unit_customer_price),
      unitDistributorPrice: Number(item.unit_distributor_price),
      pvAtSale: Number(item.pv_at_sale),
      productName: (item.products as any)?.name || 'Unknown Product',
    })),
  };
}

/**
 * Returns paginated list of customer sales for a distributor
 */
export async function listMyCustomerSales(
  distributorId: string,
  page: number = 1,
  limit: number = 20,
): Promise<{ sales: CustomerSale[]; total: number; page: number; limit: number }> {
  const offset = (page - 1) * limit;

  // Get total count
  const { count, error: countError } = await supabase
    .from('customer_sales')
    .select('*', { count: 'exact', head: true })
    .eq('distributor_id', distributorId);

  if (countError) {
    throw new ApiError(500, `Failed to count customer sales: ${countError.message}`);
  }

  // Get paginated sales
  const { data, error } = await supabase
    .from('customer_sales')
    .select(`
      id,
      distributor_id,
      customer_name,
      customer_phone,
      country_id,
      total_amount,
      total_pv,
      created_at,
      customer_sale_items (
        id,
        customer_sale_id,
        product_id,
        quantity,
        unit_customer_price,
        unit_distributor_price,
        pv_at_sale,
        products!inner (
          name
        )
      )
    `)
    .eq('distributor_id', distributorId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    throw new ApiError(500, `Failed to fetch customer sales: ${error.message}`);
  }

  const sales = (data ?? []).map((row) => ({
    id: row.id,
    distributorId: row.distributor_id,
    customerName: row.customer_name,
    customerPhone: row.customer_phone,
    countryId: row.country_id,
    totalAmount: Number(row.total_amount),
    totalPV: Number(row.total_pv),
    createdAt: row.created_at,
    items: (row.customer_sale_items as any[]).map((item) => ({
      id: item.id,
      customerSaleId: item.customer_sale_id,
      productId: item.product_id,
      quantity: Number(item.quantity),
      unitCustomerPrice: Number(item.unit_customer_price),
      unitDistributorPrice: Number(item.unit_distributor_price),
      pvAtSale: Number(item.pv_at_sale),
      productName: item.products?.name || 'Unknown Product',
    })),
  }));

  return {
    sales,
    total: count ?? 0,
    page,
    limit,
  };
}

/**
 * Returns summary of retail profit and PV from customer sales for a given month
 */
export async function getMyCustomerSalesSummary(
  distributorId: string,
  month?: string,
): Promise<CustomerSalesSummary> {
  const now = new Date();
  let startStr: string;
  let endStr: string;

  if (month) {
    const parts = month.split('-');
    const year = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1;
    startStr = new Date(Date.UTC(year, m, 1)).toISOString();
    endStr = new Date(Date.UTC(year, m + 1, 1)).toISOString();
  } else {
    const year = now.getUTCFullYear();
    const m = now.getUTCMonth();
    startStr = new Date(Date.UTC(year, m, 1)).toISOString();
    endStr = new Date(Date.UTC(year, m + 1, 1)).toISOString();
  }

  // Get total retail profit from customer_sale_items (price difference)
  const { data: sales, error: salesError } = await supabase
    .from('customer_sales')
    .select(`
      total_pv,
      customer_sale_items (
        quantity,
        unit_customer_price,
        unit_distributor_price
      )
    `)
    .eq('distributor_id', distributorId)
    .gte('created_at', startStr)
    .lt('created_at', endStr);

  if (salesError) {
    throw new ApiError(500, `Failed to fetch customer sales: ${salesError.message}`);
  }

  let totalRetailProfit = 0;
  let totalPV = 0;

  for (const sale of sales ?? []) {
    totalPV += Number(sale.total_pv ?? 0);
    
    const items = sale.customer_sale_items as any[] ?? [];
    for (const item of items) {
      const profit = (Number(item.unit_customer_price) - Number(item.unit_distributor_price)) * Number(item.quantity);
      totalRetailProfit += profit;
    }
  }

  return {
    totalRetailProfit,
    totalPV,
  };
}

/**
 * Returns detailed retail profit report for a distributor by period
 * Report-only - does not affect wallet balance
 */
export async function getRetailProfitReport(
  distributorId: string,
  month?: string,
): Promise<{ period: string; totalRetailProfit: number; totalPV: number; sales: any[] }> {
  const now = new Date();
  let startStr: string;
  let endStr: string;
  const period = month || now.toISOString().slice(0, 7); // YYYY-MM

  if (month) {
    const parts = month.split('-');
    const year = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1;
    startStr = new Date(Date.UTC(year, m, 1)).toISOString();
    endStr = new Date(Date.UTC(year, m + 1, 1)).toISOString();
  } else {
    const year = now.getUTCFullYear();
    const m = now.getUTCMonth();
    startStr = new Date(Date.UTC(year, m, 1)).toISOString();
    endStr = new Date(Date.UTC(year, m + 1, 1)).toISOString();
  }

  // Get detailed sales data with retail profit calculation
  const { data: sales, error: salesError } = await supabase
    .from('customer_sales')
    .select(`
      id,
      customer_name,
      customer_phone,
      total_amount,
      total_pv,
      created_at,
      customer_sale_items (
        id,
        product_id,
        quantity,
        unit_customer_price,
        unit_distributor_price,
        pv_at_sale
      )
    `)
    .eq('distributor_id', distributorId)
    .gte('created_at', startStr)
    .lt('created_at', endStr)
    .order('created_at', { ascending: false });

  if (salesError) {
    throw new ApiError(500, `Failed to fetch retail profit report: ${salesError.message}`);
  }

  let totalRetailProfit = 0;
  let totalPV = 0;

  const salesWithProfit = (sales ?? []).map((sale) => {
    const items = sale.customer_sale_items as any[] ?? [];
    let saleProfit = 0;
    
    const itemsWithProfit = items.map((item) => {
      const profit = (Number(item.unit_customer_price) - Number(item.unit_distributor_price)) * Number(item.quantity);
      saleProfit += profit;
      return {
        ...item,
        retail_profit: profit,
      };
    });

    totalPV += Number(sale.total_pv ?? 0);
    totalRetailProfit += saleProfit;

    return {
      ...sale,
      customer_sale_items: itemsWithProfit,
      retail_profit: saleProfit,
    };
  });

  return {
    period,
    totalRetailProfit,
    totalPV,
    sales: salesWithProfit,
  };
}
