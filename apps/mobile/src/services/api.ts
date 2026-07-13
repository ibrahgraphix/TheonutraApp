import Constants from 'expo-constants';
import type {
  Article,
  CartItem,
  CompanyBankDetails,
  DashboardStats,
  Distributor,
  DistributorRole,
  MobileMoneyProvider,
  MonthlyAnalysis,
  NewsPost,
  Order,
  Payment,
  Product,
  ProductCountryPrice,
  ProductListing,
  TeamMember,
} from '../types';
import {
  buildTeamTree,
  companyBankDetails,
  getAvailableMonths,
  getCurrencyForCountry,
  getMonthLabel,
  getMonthlyHistory,
  getProductsForCountry,
  getProductCountries as getActiveProductCountries,
  getSalesForDistributor,
  mockArticles,
  mockDistributors,
  mockNews,
  mockOrders,
  mockPayments,
  mockProducts,
  resolveProductForCountry,
  stripPassword,
} from './mockData';

function getApiBaseUrl() {
  const apiUrl =
    Constants.expoConfig?.extra?.apiUrl ||
    Constants.manifest?.extra?.apiUrl ||
    undefined;

  if (typeof apiUrl === 'string' && apiUrl.length > 0) {
    return apiUrl;
  }

  const debuggerHost =
    typeof Constants.manifest?.debuggerHost === 'string'
      ? Constants.manifest.debuggerHost
      : undefined;

  if (debuggerHost) {
    const host = debuggerHost.split(':')[0];
    if (host && host !== 'localhost' && host !== '127.0.0.1') {
      return `http://${host}:3001`;
    }

    if (Constants.platform?.android && !Constants.isDevice) {
      return 'http://10.0.2.2:3001';
    }
  }

  return 'http://localhost:3001';
}

const API_BASE_URL = getApiBaseUrl();

const delay = (ms = 400) => new Promise((resolve) => setTimeout(resolve, ms));

let currentAuthToken: string | null = null;

export function setAuthToken(token: string | null) {
  currentAuthToken = token;
}

export async function login(
  distributorId: string,
  password: string,
): Promise<{ user: Distributor; token: string }> {
  const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ distributorId, password }),
  });

  if (!response.ok) {
    const body = await response.text();
    const message = body?.trim() || 'Invalid Distributor ID or password.';
    throw new Error(message);
  }

  const data = (await response.json()) as {
    token: string;
    user: {
      distributorId: string;
      fullName: string;
      role: string;
      mustChangePassword: boolean;
    };
  };
  
  setAuthToken(data.token);

  return {
    token: data.token,
    user: {
      id: data.user.distributorId,
      distributorId: data.user.distributorId,
      fullName: data.user.fullName,
      phone: '',
      role: data.user.role as DistributorRole,
      country: '',
      referredBy: null,
      joinDate: '',
    }
  };
}

export async function requestPasswordReset(distributorId: string): Promise<void> {
  await delay(600);

  const record = mockDistributors.find(
    (d) => d.distributorId.toUpperCase() === distributorId.toUpperCase(),
  );

  if (!record) {
    throw new Error('No account found with that Distributor ID.');
  }
}

export async function getDistributorById(id: string): Promise<Distributor | null> {
  const response = await fetch(`${API_BASE_URL}/api/sellers/${id}`, {
    headers: {
      'Authorization': currentAuthToken ? `Bearer ${currentAuthToken}` : '',
    },
  });

  if (!response.ok) {
    if (response.status === 404) return null;
    throw new Error('Failed to fetch distributor');
  }

  const s = await response.json();
  return {
    id: s.id,
    distributorId: s.distributorId,
    fullName: s.fullName,
    phone: s.phoneNumber,
    role: s.role,
    country: s.countryName || s.countryId,
    referredBy: s.referredBy,
    joinDate: s.createdAt,
  };
}

export async function getDashboardStats(
  distributorId: string,
): Promise<DashboardStats> {
  await delay(300);

  const sales = getSalesForDistributor(distributorId);

  return {
    personalSales: sales.personal,
    teamSales: sales.team,
    bonusEarned: sales.bonus,
    currency: 'USD',
    period: 'July 2026',
  };
}

export async function getTeam(distributorId: string): Promise<TeamMember[]> {
  await delay(350);
  return buildTeamTree(distributorId);
}

export async function getProducts(country: string): Promise<ProductListing[]> {
  await delay(250);
  return getProductsForCountry(country);
}

export async function getProductCountries(): Promise<string[]> {
  await delay(150);
  return getActiveProductCountries();
}

export async function getProductById(
  productId: string,
  country: string,
): Promise<ProductListing | null> {
  await delay(200);
  const product = mockProducts.find((p) => p.id === productId);
  if (!product) return null;
  return resolveProductForCountry(product, country);
}

export async function getCompanyBankDetails(): Promise<CompanyBankDetails> {
  await delay(150);
  return companyBankDetails;
}

export async function submitBankTransferOrder(
  distributorId: string,
  country: string,
  items: CartItem[],
  reference: string,
): Promise<Order> {
  await delay(800);

  const order = createOrder(distributorId, country, items, {
    method: 'bank_transfer',
    reference,
  });

  mockOrders.push(order);
  mockPayments.push(createPayment(order));

  return order;
}

export async function submitMobileMoneyOrder(
  distributorId: string,
  country: string,
  items: CartItem[],
  provider: MobileMoneyProvider,
  phone: string,
): Promise<Order> {
  await delay(1000);

  const order = createOrder(distributorId, country, items, {
    method: 'mobile_money',
    provider,
    phone,
  });

  mockOrders.push(order);
  mockPayments.push(createPayment(order));

  return order;
}

export async function getOrderById(orderId: string): Promise<Order | null> {
  await delay(200);
  return mockOrders.find((o) => o.id === orderId) ?? null;
}

function createOrder(
  distributorId: string,
  country: string,
  items: CartItem[],
  payment: Order['payment'],
): Order {
  const currency = items[0]?.currency ?? 'USD';
  const total = items.reduce((sum, i) => sum + i.price * i.quantity, 0);

  return {
    id: `ord-${Date.now()}`,
    distributorId,
    country,
    items: items.map((i) => ({
      productId: i.productId,
      productName: i.name,
      quantity: i.quantity,
      unitPrice: i.price,
    })),
    total,
    currency,
    status: 'pending_confirmation',
    payment,
    createdAt: new Date().toISOString(),
  };
}

function createPayment(order: Order): Payment {
  return {
    id: `pay-${Date.now()}`,
    orderId: order.id,
    distributorId: order.distributorId,
    amount: order.total,
    currency: order.currency,
    method: order.payment.method,
    status: 'pending',
    reference: order.payment.reference,
    provider: order.payment.provider,
    phone: order.payment.phone,
    createdAt: new Date().toISOString(),
  };
}

export async function getOrders(distributorId: string): Promise<Order[]> {
  await delay(250);
  return mockOrders.filter((o) => o.distributorId === distributorId);
}

export async function getPayments(distributorId: string): Promise<Payment[]> {
  await delay(250);
  return mockPayments.filter((p) => p.distributorId === distributorId);
}

export async function getNews(): Promise<NewsPost[]> {
  await delay(250);
  return mockNews;
}

export async function getArticles(): Promise<Article[]> {
  await delay(250);
  return mockArticles;
}

export async function getMonthlyAnalysis(
  distributorId: string,
  month?: string,
): Promise<MonthlyAnalysis> {
  await delay(300);
  const months = getAvailableMonths(distributorId);
  const selectedMonth = month ?? months[0];
  const data = getMonthlyHistory(distributorId, selectedMonth);
  const distributor = mockDistributors.find((d) => d.id === distributorId);

  return {
    month: selectedMonth,
    label: getMonthLabel(selectedMonth),
    personalSales: data.personal,
    teamSales: data.team,
    bonusEarned: data.bonus,
    currency: getCurrencyForCountry(distributor?.country ?? 'Nigeria'),
  };
}

export async function getAnalysisMonths(distributorId: string): Promise<string[]> {
  await delay(150);
  return getAvailableMonths(distributorId);
}

export function getMonthLabelForKey(month: string): string {
  return getMonthLabel(month);
}

export async function getArticleById(articleId: string): Promise<Article | null> {
  await delay(200);
  return mockArticles.find((a) => a.id === articleId) ?? null;
}

export async function getNewsById(newsId: string): Promise<NewsPost | null> {
  await delay(200);
  return mockNews.find((n) => n.id === newsId) ?? null;
}

export async function createSellerAccount(payload: {
  fullName: string;
  phone: string;
  country: string;
  referredBy: string | null;
  distributorId: string;
  password: string;
}): Promise<Distributor> {
  const response = await fetch(`${API_BASE_URL}/api/sellers`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': currentAuthToken ? `Bearer ${currentAuthToken}` : '',
    },
    body: JSON.stringify({
      distributorId: payload.distributorId,
      fullName: payload.fullName,
      phoneNumber: payload.phone,
      password: payload.password,
      countryId: payload.country,
      referredBy: payload.referredBy,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Failed to create seller: ${body}`);
  }

  const s = await response.json();
  return {
    id: s.id,
    distributorId: s.distributorId,
    fullName: s.fullName,
    phone: s.phoneNumber,
    role: s.role,
    country: s.countryName || s.countryId,
    referredBy: s.referredBy,
    joinDate: s.createdAt,
  };
}

export async function resetSellerPassword(
  distributorId: string,
  newPassword: string,
): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/sellers/${distributorId}/reset-password`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': currentAuthToken ? `Bearer ${currentAuthToken}` : '',
    },
    body: JSON.stringify({ newPassword }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Failed to reset password: ${body}`);
  }
}

export async function changePassword(
  distributorId: string,
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  await delay(500);
  const record = mockDistributors.find((d) => d.id === distributorId);
  if (!record || record.password !== currentPassword) {
    throw new Error('Current password is incorrect.');
  }
  if (newPassword.length < 6) {
    throw new Error('New password must be at least 6 characters.');
  }
  record.password = newPassword;
}

export async function changePhone(
  distributorId: string,
  newPhone: string,
): Promise<Distributor> {
  await delay(400);
  const record = mockDistributors.find((d) => d.id === distributorId);
  if (!record) throw new Error('Account not found.');
  record.phone = newPhone;
  return stripPassword(record);
}

export async function deleteAccount(distributorId: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/sellers/${distributorId}/deactivate`, {
    method: 'PATCH',
    headers: {
      'Authorization': currentAuthToken ? `Bearer ${currentAuthToken}` : '',
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Failed to deactivate account: ${body}`);
  }
}

// --- Admin ---

export async function getAllDistributors(): Promise<Distributor[]> {
  const response = await fetch(`${API_BASE_URL}/api/sellers`, {
    headers: {
      'Authorization': currentAuthToken ? `Bearer ${currentAuthToken}` : '',
    }
  });
  
  if (!response.ok) {
    throw new Error('Failed to fetch sellers');
  }
  
  const sellers = await response.json() as any[];
  return sellers.map(s => ({
    id: s.id,
    distributorId: s.distributorId,
    fullName: s.fullName,
    phone: s.phoneNumber,
    role: s.role,
    country: s.countryName || s.countryId,
    referredBy: s.referredBy,
    joinDate: s.createdAt,
  }));
}

export async function searchDistributors(query: string): Promise<Distributor[]> {
  const q = query.toLowerCase().trim();
  if (!q) {
    return getAllDistributors();
  }
  
  const response = await fetch(`${API_BASE_URL}/api/sellers?search=${encodeURIComponent(q)}`, {
    headers: {
      'Authorization': currentAuthToken ? `Bearer ${currentAuthToken}` : '',
    }
  });
  
  if (!response.ok) {
    throw new Error('Failed to search sellers');
  }
  
  const sellers = await response.json() as any[];
  return sellers.map(s => ({
    id: s.id,
    distributorId: s.distributorId,
    fullName: s.fullName,
    phone: s.phoneNumber,
    role: s.role,
    country: s.countryName || s.countryId,
    referredBy: s.referredBy,
    joinDate: s.createdAt,
  }));
}

export async function getAllProducts(): Promise<Product[]> {
  await delay(250);
  return [...mockProducts];
}

export async function saveProduct(product: Product): Promise<Product> {
  await delay(500);
  const index = mockProducts.findIndex((p) => p.id === product.id);
  if (index >= 0) {
    mockProducts[index] = product;
  } else {
    mockProducts.push({ ...product, id: product.id || `prod-${Date.now()}` });
  }
  return product;
}

export async function createNewsPost(
  post: Omit<NewsPost, 'id' | 'publishedAt'>,
): Promise<NewsPost> {
  await delay(500);
  const newPost: NewsPost = {
    ...post,
    id: `news-${Date.now()}`,
    publishedAt: new Date().toISOString(),
  };
  mockNews.unshift(newPost);
  return newPost;
}

export async function getPendingPayments(): Promise<Payment[]> {
  await delay(300);
  return mockPayments.filter((p) => p.status === 'pending');
}

export async function confirmPayment(paymentId: string): Promise<Payment> {
  await delay(500);
  const payment = mockPayments.find((p) => p.id === paymentId);
  if (!payment) throw new Error('Payment not found.');
  payment.status = 'completed';
  const order = mockOrders.find((o) => o.id === payment.orderId);
  if (order) order.status = 'confirmed';
  return payment;
}

export async function getDistributorName(distributorId: string): Promise<string> {
  const record = mockDistributors.find((d) => d.id === distributorId);
  return record?.fullName ?? 'Unknown';
}

export type { ProductCountryPrice };
