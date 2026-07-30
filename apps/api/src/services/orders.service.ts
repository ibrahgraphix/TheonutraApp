//orders.services
import { supabase } from '../config/supabase.js';
import { ApiError } from '../middleware/error.middleware.js';

export interface OrderItemInput {
  productId: string;
  quantity: number;
}

export interface OrderItem {
  id: string;
  productId: string;
  productName?: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

export interface Order {
  id: string;
  buyerId: string;
  countryId: string;
  status: string;
  totalAmount: number;
  currencyCode: string;
  createdAt: string;
  updatedAt: string;
  items?: OrderItem[];
  payment?: {
    method: string;
    reference?: string;
    provider?: string;
    phone?: string;
    isConfirmed?: boolean;
  };
}

/**
 * Creates a new order.
 * 1. Resolves currency code from country.
 * 2. Fetches prices for each item from `product_prices` joined with `products` to verify active/available.
 * 3. Calculates total amount.
 * 4. Inserts order and order items in a transaction-like sequence.
 */
export async function createOrder(
  buyerId: string,
  input: { countryId: string; items: OrderItemInput[] },
): Promise<Order> {
  if (input.items.length === 0) {
    throw new ApiError(422, 'Order must contain at least one item');
  }

  // 1. Get country info for currency code
  const { data: country, error: countryError } = await supabase
    .from('countries')
    .select('currency_code, is_active')
    .eq('id', input.countryId)
    .single();

  if (countryError || !country) {
    throw new ApiError(404, 'Country not found');
  }
  if (!country.is_active) {
    throw new ApiError(422, 'Country is not active');
  }

  const currencyCode = country.currency_code;

  // 2. Fetch prices and availability for the products
  const productIds = input.items.map((item) => item.productId);
  const { data: priceRows, error: priceError } = await supabase
    .from('product_prices')
    .select(`
      price,
      is_available,
      product_id,
      products!inner (
        name,
        is_active
      )
    `)
    .eq('country_id', input.countryId)
    .in('product_id', productIds);

  if (priceError) {
    throw new ApiError(500, `Failed to fetch product prices: ${priceError.message}`);
  }

  // Map product_id -> { price, name, isAvailable, isActive }
  const priceMap = new Map<string, { price: number; name: string; isAvailable: boolean; isActive: boolean }>();
  for (const row of priceRows ?? []) {
    const prod = row.products as any;
    priceMap.set(row.product_id, {
      price: Number(row.price),
      name: prod?.name || 'Unknown Product',
      isAvailable: row.is_available,
      isActive: prod?.is_active ?? false,
    });
  }

  // Validate all items exist, are active, and available in this country
  const resolvedItems: Array<{ productId: string; quantity: number; unitPrice: number; productName: string }> = [];
  let totalAmount = 0;

  for (const item of input.items) {
    const priceInfo = priceMap.get(item.productId);
    if (!priceInfo || !priceInfo.isActive || !priceInfo.isAvailable) {
      throw new ApiError(422, `Product ${item.productId} is not available in this country`);
    }

    const itemPrice = priceInfo.price;
    const subtotal = item.quantity * itemPrice;
    totalAmount += subtotal;

    resolvedItems.push({
      productId: item.productId,
      quantity: item.quantity,
      unitPrice: itemPrice,
      productName: priceInfo.name,
    });
  }

  // 3. Create the order
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .insert({
      buyer_id: buyerId,
      country_id: input.countryId,
      status: 'pending',
      total_amount: totalAmount,
      currency_code: currencyCode,
    })
    .select('*')
    .single();

  if (orderError || !order) {
    throw new ApiError(500, `Failed to create order: ${orderError?.message}`);
  }

  // 4. Create the order items
  const orderItemRows = resolvedItems.map((item) => ({
    order_id: order.id,
    product_id: item.productId,
    quantity: item.quantity,
    unit_price: item.unitPrice,
  }));

  const { error: itemsError } = await supabase
    .from('order_items')
    .insert(orderItemRows);

  if (itemsError) {
    // Attempt rollback of the order
    await supabase.from('orders').delete().eq('id', order.id);
    throw new ApiError(500, `Failed to create order items: ${itemsError.message}`);
  }

  // Return the created order with snapshotted items
  return {
    id: order.id,
    buyerId: order.buyer_id,
    countryId: order.country_id,
    status: order.status,
    totalAmount: Number(order.total_amount),
    currencyCode: order.currency_code,
    createdAt: order.created_at,
    updatedAt: order.updated_at,
    items: resolvedItems.map((ri, index) => ({
      id: '', // database generates it, but since we just inserted, we map the fields we have
      productId: ri.productId,
      productName: ri.productName,
      quantity: ri.quantity,
      unitPrice: ri.unitPrice,
      subtotal: ri.quantity * ri.unitPrice,
    })),
    payment: undefined, // No payment yet - submitted separately
  };
}

/**
 * Retrieves a single order by ID and verifies authorization.
 */
export async function getOrderById(
  id: string,
  requesterId: string,
  isStaff: boolean,
): Promise<Order> {
  const { data: order, error } = await supabase
    .from('orders')
    .select(`
      *,
      order_items (
        id,
        product_id,
        quantity,
        unit_price,
        products (
          name
        )
      ),
      payments (
        id,
        method,
        reference_no,
        provider,
        phone_number,
        is_confirmed
      )
    `)
    .eq('id', id)
    .single();

  if (error || !order) {
    throw new ApiError(404, 'Order not found');
  }

  if (!isStaff && order.buyer_id !== requesterId) {
    throw new ApiError(403, 'You do not have permission to view this order');
  }

  const items = (order.order_items as any[] ?? []).map((item) => ({
    id: item.id,
    productId: item.product_id,
    productName: item.products?.name || 'Unknown Product',
    quantity: item.quantity,
    unitPrice: Number(item.unit_price),
    subtotal: item.quantity * Number(item.unit_price),
  }));

  // Map payment details if available
  const payments = order.payments as any[] ?? [];
  const payment = payments.length > 0 ? {
    method: payments[0].method,
    reference: payments[0].reference_no,
    provider: payments[0].provider,
    phone: payments[0].phone_number,
    isConfirmed: payments[0].is_confirmed,
  } : undefined;

  return {
    id: order.id,
    buyerId: order.buyer_id,
    countryId: order.country_id,
    status: order.status,
    totalAmount: Number(order.total_amount),
    currencyCode: order.currency_code,
    createdAt: order.created_at,
    updatedAt: order.updated_at,
    items,
    payment,
  };
}

/**
 * Lists all orders for a buyer with optional pagination.
 */
export async function listMyOrders(buyerId: string, page: number = 1, limit: number = 20): Promise<Order[]> {
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  const { data: orders, error } = await supabase
    .from('orders')
    .select(`
      *,
      order_items (
        id,
        product_id,
        quantity,
        unit_price,
        products (
          name
        )
      ),
      payments (
        id,
        method,
        reference_no,
        provider,
        phone_number,
        is_confirmed
      )
    `)
    .eq('buyer_id', buyerId)
    .order('created_at', { ascending: false })
    .range(from, to);

  if (error) {
    throw new ApiError(500, `Failed to fetch orders: ${error.message}`);
  }

  return (orders ?? []).map((order) => {
    const items = (order.order_items as any[] ?? []).map((item) => ({
      id: item.id,
      productId: item.product_id,
      productName: item.products?.name || 'Unknown Product',
      quantity: item.quantity,
      unitPrice: Number(item.unit_price),
      subtotal: item.quantity * Number(item.unit_price),
    }));

    // Map payment details if available
    const payments = order.payments as any[] ?? [];
    const payment = payments.length > 0 ? {
      method: payments[0].method,
      reference: payments[0].reference_no,
      provider: payments[0].provider,
      phone: payments[0].phone_number,
      isConfirmed: payments[0].is_confirmed,
    } : undefined;

    return {
      id: order.id,
      buyerId: order.buyer_id,
      countryId: order.country_id,
      status: order.status,
      totalAmount: Number(order.total_amount),
      currencyCode: order.currency_code,
      createdAt: order.created_at,
      updatedAt: order.updated_at,
      items,
      payment,
    };
  });
}

export interface AwaitingPaymentOrder extends Omit<Order, 'buyerId'> {
  buyerName?: string;
  distributorId?: string;
}

/**
 * Lists orders that are still 'pending' with NO payment record submitted at
 * all — i.e. "Pay Later" orders where the distributor chose to settle
 * outside the bank/mobile-money flow. Distinct from "Pending Payments",
 * which lists orders that already have an unconfirmed payment reference.
 * Staff only.
 */
export async function listAwaitingPaymentOrders(): Promise<AwaitingPaymentOrder[]> {
  const { data: orders, error } = await supabase
    .from('orders')
    .select(`
      *,
      order_items (
        id,
        product_id,
        quantity,
        unit_price,
        products ( name )
      ),
      payments ( id ),
      profiles!orders_buyer_id_fkey (
        full_name,
        distributor_id
      )
    `)
    .eq('status', 'pending')
    .order('created_at', { ascending: true });

  if (error) {
    throw new ApiError(500, `Failed to list awaiting-payment orders: ${error.message}`);
  }

  return (orders ?? [])
    .filter((order) => !order.payments || (order.payments as any[]).length === 0)
    .map((order) => {
      const items = (order.order_items as any[] ?? []).map((item) => ({
        id: item.id,
        productId: item.product_id,
        productName: item.products?.name || 'Unknown Product',
        quantity: item.quantity,
        unitPrice: Number(item.unit_price),
        subtotal: item.quantity * Number(item.unit_price),
      }));

      const profile = order.profiles as any;

      return {
        id: order.id,
        buyerId: order.buyer_id,
        countryId: order.country_id,
        status: order.status,
        totalAmount: Number(order.total_amount),
        currencyCode: order.currency_code,
        createdAt: order.created_at,
        updatedAt: order.updated_at,
        items,
        buyerName: profile?.full_name,
        distributorId: profile?.distributor_id,
      };
    });
}
