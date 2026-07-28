//api.ts
import Constants from 'expo-constants';
import type {
  Article,
  CompanyBankDetails,
  Country,
  CreateCountryInput,
  DashboardStats,
  Distributor,
  DistributorRole,
  MobileMoneyProvider,
  MonthlyAnalysis,
  NewsPost,
  Order,
  OrderItem,
  Payment,
  Product,
  ProductCountryPrice,
  ProductListing,
  TeamMember,
} from '../types';

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

function parseApiError(body: string, fallback: string): string {
  const trimmed = body?.trim();
  if (!trimmed) return fallback;
  try {
    const parsed = JSON.parse(trimmed) as { error?: string };
    if (parsed.error) return parsed.error;
  } catch {
    // not JSON
  }
  return trimmed;
}

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
      id: string;
      distributorId: string;
      fullName: string;
      role: string;
      country: string;
      countryId: string;
      mustChangePassword: boolean;
    };
  };

  setAuthToken(data.token);

  return {
    token: data.token,
    user: {
      id: data.user.id,
      distributorId: data.user.distributorId,
      fullName: data.user.fullName,
      phone: '',
      role: data.user.role as DistributorRole,
      country: data.user.country,
      countryId: data.user.countryId,
      referredBy: null,
      joinDate: '',
    }
  };
}

export async function requestPasswordReset(distributorId: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/auth/reset-password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ distributorId }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(body?.trim() || 'No account found with that Distributor ID.');
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
    isActive: s.isActive,
  };
}

export async function getDashboardStats(
  distributorId: string,
): Promise<DashboardStats> {
  const response = await fetch(`${API_BASE_URL}/api/analytics/overview`, {
    headers: {
      Authorization: currentAuthToken ? `Bearer ${currentAuthToken}` : '',
    },
  });

  if (!response.ok) {
    throw new Error(parseApiError(await response.text(), 'Failed to fetch dashboard stats'));
  }

  const stats = await response.json();
  return {
    personalSales: stats.personalSales ?? 0,
    teamSales: stats.teamSales ?? 0,
    bonusEarned: stats.bonusEarned ?? 0,
    currency: stats.currency ?? 'USD',
    period: stats.period ?? new Date().toLocaleString('default', { month: 'long', year: 'numeric' }),
  };
}

export async function getTeam(distributorId: string): Promise<TeamMember[]> {
  const response = await fetch(`${API_BASE_URL}/api/team/full`, {
    headers: {
      Authorization: currentAuthToken ? `Bearer ${currentAuthToken}` : '',
    },
  });

  if (!response.ok) {
    throw new Error(parseApiError(await response.text(), 'Failed to fetch team'));
  }

  const flatTeam = await response.json();

  // Transform flat list to nested tree structure
  return buildTeamTree(flatTeam);
}

/**
 * Staff-only: fetch ANY distributor's full multi-level downline as a nested
 * tree, via the staff-only `/api/team/:id` endpoint. This is what powers
 * Manage → Distributors → tap a distributor → chain view — admin no longer
 * has a separate "Team" tab, so this is the only way staff view a downline
 * that isn't their own.
 */
export async function getTeamForDistributor(distributorId: string): Promise<TeamMember[]> {
  const response = await fetch(
    `${API_BASE_URL}/api/team/${encodeURIComponent(distributorId)}`,
    {
      headers: {
        Authorization: currentAuthToken ? `Bearer ${currentAuthToken}` : '',
      },
    },
  );

  if (!response.ok) {
    throw new Error(parseApiError(await response.text(), 'Failed to fetch distributor team'));
  }

  const flatTeam = await response.json();
  return buildTeamTree(flatTeam);
}

function buildTeamTree(flatTeam: any[]): TeamMember[] {
  const memberMap = new Map<string, any>();

  // First pass: create map of all members
  for (const member of flatTeam) {
    memberMap.set(member.memberId, {
      distributor: {
        id: member.memberId,
        distributorId: member.distributorId,
        fullName: member.fullName,
        phone: member.phoneNumber,
        role: 'distributor' as const,
        country: member.countryId,
        countryId: member.countryId,
        referredBy: member.referredBy,
        joinDate: member.createdAt ?? '',
      },
      level: member.level,
      personalSales: member.monthlySales,
      teamSales: 0,
      recruitsCount: 0,
      children: [],
    });
  }

  // Second pass: build hierarchy
  const roots: TeamMember[] = [];
  for (const member of flatTeam) {
    const node = memberMap.get(member.memberId);
    if (!node) continue;

    if (member.referredBy && memberMap.has(member.referredBy)) {
      const parent = memberMap.get(member.referredBy);
      parent.children.push(node);
      parent.recruitsCount++;
    } else {
      roots.push(node);
    }
  }

  // Calculate team sales (sum of all descendants' personal sales)
  function calculateTeamSales(node: TeamMember): number {
    let total = node.personalSales;
    for (const child of node.children) {
      total += calculateTeamSales(child);
    }
    node.teamSales = total;
    return total;
  }

  for (const root of roots) {
    calculateTeamSales(root);
  }

  return roots;
}

async function resolveCountryId(country: string): Promise<string> {
  const trimmed = country.trim();
  if (!trimmed) {
    throw new Error('Country is required');
  }

  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (uuidRegex.test(trimmed)) {
    return trimmed;
  }

  const countries = await getCountries();
  const match = countries.find(
    (c) =>
      c.id === trimmed ||
      c.name.toLowerCase() === trimmed.toLowerCase() ||
      c.isoCode.toLowerCase() === trimmed.toLowerCase(),
  );

  if (!match) {
    throw new Error(`Unknown country: ${country}`);
  }

  return match.id;
}

function mapApiProductToListing(
  p: {
    id: string;
    name: string;
    description: string | null;
    imageUrl: string | null;
    price?: number;
    currencyCode?: string;
  },
  countryName: string,
): ProductListing {
  return {
    id: p.id,
    name: p.name,
    description: p.description ?? '',
    imageUrl: p.imageUrl ?? undefined,
    category: 'Products',
    pricing: [
      {
        country: countryName,
        price: p.price ?? 0,
        currency: p.currencyCode ?? 'USD',
        available: true,
      },
    ],
    price: p.price ?? 0,
    currency: p.currencyCode ?? 'USD',
    available: true,
  };
}

export async function getProducts(country: string): Promise<ProductListing[]> {
  const countryId = await resolveCountryId(country);
  const response = await fetch(
    `${API_BASE_URL}/api/products?countryId=${encodeURIComponent(countryId)}`,
    {
      headers: {
        Authorization: currentAuthToken ? `Bearer ${currentAuthToken}` : '',
      },
    },
  );

  if (!response.ok) {
    throw new Error(parseApiError(await response.text(), 'Failed to fetch products'));
  }

  const products = (await response.json()) as Array<{
    id: string;
    name: string;
    description: string | null;
    imageUrl: string | null;
    price?: number;
    currencyCode?: string;
  }>;

  return products.map((p) => mapApiProductToListing(p, country));
}

export async function getCountries(): Promise<Country[]> {
  const response = await fetch(`${API_BASE_URL}/api/countries`, {
    headers: {
      Authorization: currentAuthToken ? `Bearer ${currentAuthToken}` : '',
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(body?.trim() || 'Failed to fetch countries');
  }

  const rows = (await response.json()) as Array<{
    id: string;
    name: string;
    isoCode: string;
    currencyCode: string;
    isActive: boolean;
    createdAt: string;
  }>;

  return rows.map((c) => ({
    id: c.id,
    name: c.name,
    isoCode: c.isoCode,
    currencyCode: c.currencyCode,
    isActive: c.isActive,
    createdAt: c.createdAt,
  }));
}

export async function createCountry(input: CreateCountryInput): Promise<Country> {
  const response = await fetch(`${API_BASE_URL}/api/countries`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: currentAuthToken ? `Bearer ${currentAuthToken}` : '',
    },
    body: JSON.stringify({
      name: input.name.trim(),
      isoCode: input.isoCode.trim().toUpperCase(),
      currencyCode: input.currencyCode.trim().toUpperCase(),
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(parseApiError(body, 'Failed to create country'));
  }

  return response.json() as Promise<Country>;
}

export async function getProductCountries(): Promise<string[]> {
  const countries = await getCountries();
  return countries.map((c) => c.name);
}

export async function getProductById(
  productId: string,
  country: string,
): Promise<ProductListing | null> {
  try {
    const countryId = await resolveCountryId(country);
    const response = await fetch(
      `${API_BASE_URL}/api/products/${encodeURIComponent(productId)}?countryId=${encodeURIComponent(countryId)}`,
      {
        headers: {
          Authorization: currentAuthToken ? `Bearer ${currentAuthToken}` : '',
        },
      },
    );

    if (response.status === 404) return null;
    if (!response.ok) {
      throw new Error(parseApiError(await response.text(), 'Failed to fetch product'));
    }

    const p = (await response.json()) as {
      id: string;
      name: string;
      description: string | null;
      imageUrl: string | null;
      price?: number;
      currencyCode?: string;
    };

    return mapApiProductToListing(p, country);
  } catch {
    return null;
  }
}

export async function getCompanyBankDetails(): Promise<CompanyBankDetails> {
  // Return hardcoded bank details for now since endpoint doesn't exist
  return {
    bankName: 'Zenith Bank',
    accountName: 'Theonutra Ltd',
    accountNumber: '2087654321',
    branchCode: 'ZN-NG-001',
    swiftCode: 'ZEIBNGLA',
  };
}

export async function submitBankTransferOrder(
  distributorId: string,
  country: string,
  items: OrderItem[],
  reference: string,
): Promise<Order> {
  // First create the order
  const orderResponse = await fetch(`${API_BASE_URL}/api/orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: currentAuthToken ? `Bearer ${currentAuthToken}` : '',
    },
    body: JSON.stringify({
      countryId: country,
      items: items.map((i) => ({
        productId: i.productId,
        quantity: i.quantity,
      })),
    }),
  });

  if (!orderResponse.ok) {
    throw new Error(parseApiError(await orderResponse.text(), 'Failed to submit order'));
  }

  const order = await orderResponse.json();

  // Then submit the bank payment
  const paymentResponse = await fetch(`${API_BASE_URL}/api/payments/bank`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: currentAuthToken ? `Bearer ${currentAuthToken}` : '',
    },
    body: JSON.stringify({
      orderId: order.id,
      referenceNo: reference,
    }),
  });

  if (!paymentResponse.ok) {
    throw new Error(parseApiError(await paymentResponse.text(), 'Failed to submit payment'));
  }

  return order;
}

export async function submitMobileMoneyOrder(
  distributorId: string,
  country: string,
  items: OrderItem[],
  provider: MobileMoneyProvider,
  phone: string,
): Promise<Order> {
  // First create the order
  const orderResponse = await fetch(`${API_BASE_URL}/api/orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: currentAuthToken ? `Bearer ${currentAuthToken}` : '',
    },
    body: JSON.stringify({
      countryId: country,
      items: items.map((i) => ({
        productId: i.productId,
        quantity: i.quantity,
      })),
    }),
  });

  if (!orderResponse.ok) {
    throw new Error(parseApiError(await orderResponse.text(), 'Failed to submit order'));
  }

  const order = await orderResponse.json();

  // Then submit the mobile money payment
  const paymentResponse = await fetch(`${API_BASE_URL}/api/payments/mobile-money`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: currentAuthToken ? `Bearer ${currentAuthToken}` : '',
    },
    body: JSON.stringify({
      orderId: order.id,
      phoneNumber: phone,
    }),
  });

  if (!paymentResponse.ok) {
    throw new Error(parseApiError(await paymentResponse.text(), 'Failed to submit payment'));
  }

  return order;
}

export async function getOrderById(orderId: string): Promise<Order | null> {
  const response = await fetch(`${API_BASE_URL}/api/orders/${encodeURIComponent(orderId)}`, {
    headers: {
      Authorization: currentAuthToken ? `Bearer ${currentAuthToken}` : '',
    },
  });

  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(parseApiError(await response.text(), 'Failed to fetch order'));
  }

  return await response.json();
}


export async function getOrders(distributorId: string): Promise<Order[]> {
  const response = await fetch(`${API_BASE_URL}/api/orders`, {
    headers: {
      Authorization: currentAuthToken ? `Bearer ${currentAuthToken}` : '',
    },
  });

  if (!response.ok) {
    throw new Error(parseApiError(await response.text(), 'Failed to fetch orders'));
  }

  return await response.json();
}

export async function getPayments(distributorId: string): Promise<Payment[]> {
  const response = await fetch(`${API_BASE_URL}/api/payments`, {
    headers: {
      Authorization: currentAuthToken ? `Bearer ${currentAuthToken}` : '',
    },
  });

  if (!response.ok) {
    throw new Error(parseApiError(await response.text(), 'Failed to fetch payments'));
  }

  return await response.json();
}

function mapApiNews(row: {
  id: string;
  title: string;
  body: string;
  coverImageUrl: string | null;
  createdAt: string;
}): NewsPost {
  const body = row.body ?? '';
  const excerpt =
    body.length > 160 ? `${body.slice(0, 157).trimEnd()}…` : body;

  return {
    id: row.id,
    title: row.title,
    excerpt,
    content: body,
    imageUrl: row.coverImageUrl ?? undefined,
    publishedAt: row.createdAt,
  };
}

export async function getNews(): Promise<NewsPost[]> {
  const response = await fetch(`${API_BASE_URL}/api/news`, {
    headers: {
      Authorization: currentAuthToken ? `Bearer ${currentAuthToken}` : '',
    },
  });

  if (!response.ok) {
    throw new Error(parseApiError(await response.text(), 'Failed to fetch news'));
  }

  const rows = (await response.json()) as Array<{
    id: string;
    title: string;
    body: string;
    coverImageUrl: string | null;
    createdAt: string;
  }>;

  return rows.map(mapApiNews);
}

function mapApiArticle(row: {
  id: string;
  title: string;
  body: string;
  coverImageUrl: string | null;
  createdAt: string;
}): Article {
  const body = row.body ?? '';
  // Backend only stores one `body` field — no separate summary/category/author
  // columns exist yet. Derive a short summary the same way News does, and use
  // safe placeholders for the two fields the DB genuinely doesn't have.
  const summary = body.length > 160 ? `${body.slice(0, 157).trimEnd()}…` : body;

  return {
    id: row.id,
    title: row.title,
    summary,
    content: body,
    imageUrl: row.coverImageUrl ?? undefined,
    publishedAt: row.createdAt,
    category: 'General', // placeholder — no `category` column in the DB yet
    author: '', // placeholder — no author-name resolution wired up yet
  };
}

export async function getArticles(): Promise<Article[]> {
  const response = await fetch(`${API_BASE_URL}/api/articles`, {
    headers: {
      Authorization: currentAuthToken ? `Bearer ${currentAuthToken}` : '',
    },
  });

  if (!response.ok) {
    throw new Error(parseApiError(await response.text(), 'Failed to fetch articles'));
  }

  const rows = (await response.json()) as Array<{
    id: string;
    title: string;
    body: string;
    coverImageUrl: string | null;
    createdAt: string;
  }>;

  return rows.map(mapApiArticle);
}

export async function getMonthlyAnalysis(
  distributorId: string,
  month?: string,
): Promise<MonthlyAnalysis> {
  const url = month
    ? `${API_BASE_URL}/api/analytics/overview?month=${encodeURIComponent(month)}`
    : `${API_BASE_URL}/api/analytics/overview`;

  const response = await fetch(url, {
    headers: {
      Authorization: currentAuthToken ? `Bearer ${currentAuthToken}` : '',
    },
  });

  if (!response.ok) {
    throw new Error(parseApiError(await response.text(), 'Failed to fetch monthly analysis'));
  }

  const data = await response.json();
  return {
    month: data.month,
    label: data.label,
    personalSales: data.personalSales ?? 0,
    teamSales: data.teamSales ?? 0,
    bonusEarned: data.bonusEarned ?? 0,
    currency: data.currency ?? 'USD',
  };
}

export async function getAnalysisMonths(distributorId: string): Promise<string[]> {
  // Return available months based on current year
  const months: string[] = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(date.toISOString().slice(0, 7)); // YYYY-MM format
  }
  return months;
}

export function getMonthLabelForKey(month: string): string {
  const date = new Date(month);
  return date.toLocaleString('default', { month: 'long', year: 'numeric' });
}

export async function getArticleById(articleId: string): Promise<Article | null> {
  const response = await fetch(`${API_BASE_URL}/api/articles/${encodeURIComponent(articleId)}`, {
    headers: {
      Authorization: currentAuthToken ? `Bearer ${currentAuthToken}` : '',
    },
  });

  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(parseApiError(await response.text(), 'Failed to fetch article'));
  }

  const row = (await response.json()) as {
    id: string;
    title: string;
    body: string;
    coverImageUrl: string | null;
    createdAt: string;
  };

  return mapApiArticle(row);
}

export async function getNewsById(newsId: string): Promise<NewsPost | null> {
  const response = await fetch(`${API_BASE_URL}/api/news/${encodeURIComponent(newsId)}`, {
    headers: {
      Authorization: currentAuthToken ? `Bearer ${currentAuthToken}` : '',
    },
  });

  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(parseApiError(await response.text(), 'Failed to fetch news'));
  }

  const row = (await response.json()) as {
    id: string;
    title: string;
    body: string;
    coverImageUrl: string | null;
    createdAt: string;
  };

  return mapApiNews(row);
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
    throw new Error(parseApiError(body, 'Failed to create seller'));
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
  const response = await fetch(`${API_BASE_URL}/api/account/password`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: currentAuthToken ? `Bearer ${currentAuthToken}` : '',
    },
    body: JSON.stringify({
      currentPassword,
      newPassword,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(parseApiError(body, 'Failed to change password'));
  }
}

export async function changePhone(
  distributorId: string,
  newPhone: string,
): Promise<Distributor> {
  const response = await fetch(`${API_BASE_URL}/api/account/phone`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: currentAuthToken ? `Bearer ${currentAuthToken}` : '',
    },
    body: JSON.stringify({ phoneNumber: newPhone }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(parseApiError(body, 'Failed to update phone'));
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

export async function deleteAccount(distributorId: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/account`, {
    method: 'DELETE',
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
    isActive: s.isActive,
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
    isActive: s.isActive,
  }));
}

export type CreateProductPayload = {
  name: string;
  description?: string;
  imageUrl?: string;
  prices: Array<{
    countryId: string;
    price: number;
    isAvailable: boolean;
  }>;
};

export async function createProduct(payload: CreateProductPayload): Promise<Product> {
  const response = await fetch(`${API_BASE_URL}/api/products`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: currentAuthToken ? `Bearer ${currentAuthToken}` : '',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(parseApiError(await response.text(), 'Failed to create product'));
  }

  const p = (await response.json()) as {
    id: string;
    name: string;
    description: string | null;
    imageUrl: string | null;
  };

  return {
    id: p.id,
    name: p.name,
    description: p.description ?? '',
    imageUrl: p.imageUrl ?? undefined,
    category: 'Products',
    pricing: [],
  };
}

export async function getAllProducts(): Promise<Product[]> {
  const countries = await getCountries();
  if (countries.length === 0) return [];

  const listings = await Promise.all(
    countries.map(async (c) => {
      try {
        return await getProducts(c.name);
      } catch {
        return [] as ProductListing[];
      }
    }),
  );

  const byId = new Map<string, Product>();
  for (const list of listings) {
    for (const item of list) {
      const existing = byId.get(item.id);
      if (existing) {
        existing.pricing = [...existing.pricing, ...item.pricing];
      } else {
        byId.set(item.id, {
          id: item.id,
          name: item.name,
          description: item.description,
          imageUrl: item.imageUrl,
          category: item.category,
          pricing: [...item.pricing],
        });
      }
    }
  }

  return Array.from(byId.values());
}

export async function saveProduct(product: Product): Promise<Product> {
  const prices = product.pricing
    .filter((p) => p.available && p.price > 0)
    .map((p) => ({
      countryId: p.country,
      price: p.price,
      isAvailable: true,
    }));

  if (prices.length === 0) {
    throw new Error('Add at least one country price and mark it available.');
  }

  // `product.pricing[].country` may already be a UUID from the manage form
  return createProduct({
    name: product.name,
    description: product.description,
    imageUrl: product.imageUrl,
    prices,
  });
}

export async function createNewsPost(
  post: Omit<NewsPost, 'id' | 'publishedAt'>,
): Promise<NewsPost> {
  const body =
    post.excerpt?.trim() && post.content?.trim()
      ? `${post.excerpt.trim()}\n\n${post.content.trim()}`
      : post.content.trim() || post.excerpt.trim();

  const response = await fetch(`${API_BASE_URL}/api/news`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: currentAuthToken ? `Bearer ${currentAuthToken}` : '',
    },
    body: JSON.stringify({
      title: post.title.trim(),
      body,
      coverImageUrl: post.imageUrl ?? null,
      isPublished: true,
    }),
  });

  if (!response.ok) {
    throw new Error(parseApiError(await response.text(), 'Failed to publish news'));
  }

  const row = (await response.json()) as {
    id: string;
    title: string;
    body: string;
    coverImageUrl: string | null;
    createdAt: string;
  };

  return mapApiNews(row);
}

export async function createArticle(
  article: Omit<Article, 'id' | 'publishedAt' | 'category' | 'author'>,
): Promise<Article> {
  // Same pattern as createNewsPost: the backend only has one `body` field,
  // so combine summary + content into it, and split back out on read via
  // mapApiArticle's truncation-based summary derivation.
  const body =
    article.summary?.trim() && article.content?.trim()
      ? `${article.summary.trim()}\n\n${article.content.trim()}`
      : article.content?.trim() || article.summary?.trim() || '';

  const response = await fetch(`${API_BASE_URL}/api/articles`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: currentAuthToken ? `Bearer ${currentAuthToken}` : '',
    },
    body: JSON.stringify({
      title: article.title.trim(),
      body,
      coverImageUrl: article.imageUrl ?? null,
      isPublished: true,
    }),
  });

  if (!response.ok) {
    throw new Error(parseApiError(await response.text(), 'Failed to publish article'));
  }

  const row = (await response.json()) as {
    id: string;
    title: string;
    body: string;
    coverImageUrl: string | null;
    createdAt: string;
  };

  return mapApiArticle(row);
}

export async function getPendingPayments(): Promise<Payment[]> {
  const response = await fetch(`${API_BASE_URL}/api/payments/pending`, {
    headers: {
      Authorization: currentAuthToken ? `Bearer ${currentAuthToken}` : '',
    },
  });

  if (!response.ok) {
    throw new Error(parseApiError(await response.text(), 'Failed to fetch pending payments'));
  }

  return await response.json();
}

export async function confirmPayment(paymentId: string): Promise<Payment> {
  const response = await fetch(`${API_BASE_URL}/api/payments/${encodeURIComponent(paymentId)}/confirm`, {
    method: 'PATCH',
    headers: {
      Authorization: currentAuthToken ? `Bearer ${currentAuthToken}` : '',
    },
  });

  if (!response.ok) {
    throw new Error(parseApiError(await response.text(), 'Failed to confirm payment'));
  }

  return await response.json();
}

export async function getDistributorName(distributorId: string): Promise<string> {
  const distributor = await getDistributorById(distributorId);
  return distributor?.fullName ?? 'Unknown';
}

export type { ProductCountryPrice };

export function getCurrencyForCountry(country: string): string {
  const map: Record<string, string> = {
    Nigeria: 'NGN',
    Ghana: 'GHS',
    Kenya: 'KES',
    'South Africa': 'ZAR',
  };
  return map[country] ?? 'USD';
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 1 API Services
// ─────────────────────────────────────────────────────────────────────────────

import type {
  RankProgress,
  CustomerSale,
  LogCustomerSaleInput,
  TeamBonusSummary,
  TeamBonusRate,
  WalletBalance,
  Transaction,
  WithdrawalRequest,
  WithdrawalMethod,
  KycSubmission,
  SubmitKycInput,
  ReferralInfo,
  Notification,
  TrainingCategory,
  TrainingMaterial,
  Event,
  EventType,
  LoyaltyData,
  AuditLogEntry,
  Rank,
} from '../types';

// ── Ranks & PV ───────────────────────────────────────────────────────────────

export async function getRanks(): Promise<Rank[]> {
  const response = await fetch(`${API_BASE_URL}/api/ranks`, {
    headers: { Authorization: currentAuthToken ? `Bearer ${currentAuthToken}` : '' },
  });
  if (!response.ok) throw new Error(parseApiError(await response.text(), 'Failed to fetch ranks'));
  return response.json();
}

export async function getMyRankProgress(): Promise<RankProgress> {
  const response = await fetch(`${API_BASE_URL}/api/ranks/me`, {
    headers: { Authorization: currentAuthToken ? `Bearer ${currentAuthToken}` : '' },
  });
  if (!response.ok) throw new Error(parseApiError(await response.text(), 'Failed to fetch rank progress'));
  return response.json();
}

export async function promoteDistributor(
  distributorId: string,
  newRankId: string,
): Promise<void> {
  const response = await fetch(
    `${API_BASE_URL}/api/ranks/${encodeURIComponent(distributorId)}/promote`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: currentAuthToken ? `Bearer ${currentAuthToken}` : '',
      },
      body: JSON.stringify({ newRankId }),
    },
  );
  if (!response.ok) throw new Error(parseApiError(await response.text(), 'Failed to promote distributor'));
}

// ── Customer Sales ────────────────────────────────────────────────────────────

export async function logCustomerSale(
  input: LogCustomerSaleInput,
): Promise<CustomerSale> {
  const response = await fetch(`${API_BASE_URL}/api/customer-sales`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: currentAuthToken ? `Bearer ${currentAuthToken}` : '',
    },
    body: JSON.stringify(input),
  });
  if (!response.ok) throw new Error(parseApiError(await response.text(), 'Failed to log customer sale'));
  return response.json();
}

export async function getMyCustomerSales(
  page = 1,
  limit = 20,
): Promise<{ sales: CustomerSale[]; total: number; page: number; limit: number }> {
  const response = await fetch(
    `${API_BASE_URL}/api/customer-sales?page=${page}&limit=${limit}`,
    {
      headers: { Authorization: currentAuthToken ? `Bearer ${currentAuthToken}` : '' },
    },
  );
  if (!response.ok) throw new Error(parseApiError(await response.text(), 'Failed to fetch customer sales'));
  return response.json();
}

// ── Team Bonus ────────────────────────────────────────────────────────────────

export async function getMyTeamBonusSummary(period?: string): Promise<TeamBonusSummary> {
  const url = period
    ? `${API_BASE_URL}/api/team-bonus/my-summary?period=${encodeURIComponent(period)}`
    : `${API_BASE_URL}/api/team-bonus/my-summary`;
  const response = await fetch(url, {
    headers: { Authorization: currentAuthToken ? `Bearer ${currentAuthToken}` : '' },
  });
  if (!response.ok) throw new Error(parseApiError(await response.text(), 'Failed to fetch team bonus summary'));
  return response.json();
}

export async function getTeamBonusRates(): Promise<TeamBonusRate[]> {
  const response = await fetch(`${API_BASE_URL}/api/team-bonus/rates`, {
    headers: { Authorization: currentAuthToken ? `Bearer ${currentAuthToken}` : '' },
  });
  if (!response.ok) throw new Error(parseApiError(await response.text(), 'Failed to fetch team bonus rates'));
  return response.json();
}

export async function updateTeamBonusRates(
  rates: Array<{ rankId: string; level: number; percentage: number }>,
): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/team-bonus/rates`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: currentAuthToken ? `Bearer ${currentAuthToken}` : '',
    },
    body: JSON.stringify({ rates }),
  });
  if (!response.ok) throw new Error(parseApiError(await response.text(), 'Failed to update team bonus rates'));
}

export async function runTeamBonusBatch(
  period: string,
): Promise<{ processed: number; skipped: number }> {
  const response = await fetch(`${API_BASE_URL}/api/team-bonus/run`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: currentAuthToken ? `Bearer ${currentAuthToken}` : '',
    },
    body: JSON.stringify({ period }),
  });
  if (!response.ok) throw new Error(parseApiError(await response.text(), 'Failed to run team bonus batch'));
  return response.json();
}

// ── Wallet & Withdrawals ──────────────────────────────────────────────────────

export async function getMyWallet(): Promise<WalletBalance> {
  const response = await fetch(`${API_BASE_URL}/api/wallet/me`, {
    headers: { Authorization: currentAuthToken ? `Bearer ${currentAuthToken}` : '' },
  });
  if (!response.ok) throw new Error(parseApiError(await response.text(), 'Failed to fetch wallet'));
  return response.json();
}

export async function getMyTransactions(
  page = 1,
  limit = 20,
): Promise<{ transactions: Transaction[]; total: number; page: number; limit: number }> {
  const response = await fetch(
    `${API_BASE_URL}/api/wallet/transactions?page=${page}&limit=${limit}`,
    {
      headers: { Authorization: currentAuthToken ? `Bearer ${currentAuthToken}` : '' },
    },
  );
  if (!response.ok) throw new Error(parseApiError(await response.text(), 'Failed to fetch transactions'));
  return response.json();
}

export async function requestWithdrawal(
  amount: number,
  method: WithdrawalMethod,
  payoutDetails: string,
): Promise<{ id: string; message: string }> {
  const response = await fetch(`${API_BASE_URL}/api/wallet/withdrawals`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: currentAuthToken ? `Bearer ${currentAuthToken}` : '',
    },
    body: JSON.stringify({ amount, method, payoutDetails }),
  });
  if (!response.ok) throw new Error(parseApiError(await response.text(), 'Failed to request withdrawal'));
  return response.json();
}

export async function getMyWithdrawals(): Promise<WithdrawalRequest[]> {
  const response = await fetch(`${API_BASE_URL}/api/wallet/withdrawals`, {
    headers: { Authorization: currentAuthToken ? `Bearer ${currentAuthToken}` : '' },
  });
  if (!response.ok) throw new Error(parseApiError(await response.text(), 'Failed to fetch withdrawals'));
  return response.json();
}

export async function getAllWithdrawals(status?: string): Promise<WithdrawalRequest[]> {
  const url = status
    ? `${API_BASE_URL}/api/wallet/withdrawals/all?status=${encodeURIComponent(status)}`
    : `${API_BASE_URL}/api/wallet/withdrawals/all`;
  const response = await fetch(url, {
    headers: { Authorization: currentAuthToken ? `Bearer ${currentAuthToken}` : '' },
  });
  if (!response.ok) throw new Error(parseApiError(await response.text(), 'Failed to fetch all withdrawals'));
  return response.json();
}

export async function approveWithdrawal(id: string): Promise<void> {
  const response = await fetch(
    `${API_BASE_URL}/api/wallet/withdrawals/${encodeURIComponent(id)}/approve`,
    {
      method: 'PUT',
      headers: { Authorization: currentAuthToken ? `Bearer ${currentAuthToken}` : '' },
    },
  );
  if (!response.ok) throw new Error(parseApiError(await response.text(), 'Failed to approve withdrawal'));
}

export async function rejectWithdrawal(id: string, notes: string): Promise<void> {
  const response = await fetch(
    `${API_BASE_URL}/api/wallet/withdrawals/${encodeURIComponent(id)}/reject`,
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: currentAuthToken ? `Bearer ${currentAuthToken}` : '',
      },
      body: JSON.stringify({ notes }),
    },
  );
  if (!response.ok) throw new Error(parseApiError(await response.text(), 'Failed to reject withdrawal'));
}

export async function markWithdrawalPaid(id: string): Promise<void> {
  const response = await fetch(
    `${API_BASE_URL}/api/wallet/withdrawals/${encodeURIComponent(id)}/mark-paid`,
    {
      method: 'PUT',
      headers: { Authorization: currentAuthToken ? `Bearer ${currentAuthToken}` : '' },
    },
  );
  if (!response.ok) throw new Error(parseApiError(await response.text(), 'Failed to mark withdrawal as paid'));
}

// ── KYC ───────────────────────────────────────────────────────────────────────

export async function submitKyc(
  data: SubmitKycInput,
): Promise<KycSubmission> {
  const response = await fetch(`${API_BASE_URL}/api/kyc/submit`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: currentAuthToken ? `Bearer ${currentAuthToken}` : '',
    },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error(parseApiError(await response.text(), 'Failed to submit KYC'));
  return response.json();
}

export async function getMyKyc(): Promise<{ status: string; submission: KycSubmission | null }> {
  const response = await fetch(`${API_BASE_URL}/api/kyc/me`, {
    headers: { Authorization: currentAuthToken ? `Bearer ${currentAuthToken}` : '' },
  });
  if (!response.ok) throw new Error(parseApiError(await response.text(), 'Failed to fetch KYC status'));
  return response.json();
}

export async function getPendingKyc(
  page = 1,
  limit = 20,
): Promise<{ submissions: KycSubmission[]; total: number; page: number; limit: number }> {
  const response = await fetch(
    `${API_BASE_URL}/api/kyc/pending?page=${page}&limit=${limit}`,
    {
      headers: { Authorization: currentAuthToken ? `Bearer ${currentAuthToken}` : '' },
    },
  );
  if (!response.ok) throw new Error(parseApiError(await response.text(), 'Failed to fetch pending KYC'));
  return response.json();
}

export async function getKycSubmission(id: string): Promise<KycSubmission> {
  const response = await fetch(`${API_BASE_URL}/api/kyc/${encodeURIComponent(id)}`, {
    headers: { Authorization: currentAuthToken ? `Bearer ${currentAuthToken}` : '' },
  });
  if (!response.ok) throw new Error(parseApiError(await response.text(), 'Failed to fetch KYC submission'));
  return response.json();
}

export async function reviewKyc(
  id: string,
  decision: 'approve' | 'reject' | 'request_resubmission',
  reason?: string,
): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/kyc/${encodeURIComponent(id)}/review`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: currentAuthToken ? `Bearer ${currentAuthToken}` : '',
    },
    body: JSON.stringify({ decision, reason }),
  });
  if (!response.ok) throw new Error(parseApiError(await response.text(), 'Failed to review KYC'));
}

// ── Referrals ─────────────────────────────────────────────────────────────────

export async function getMyReferralInfo(): Promise<ReferralInfo> {
  const response = await fetch(`${API_BASE_URL}/api/referral/me`, {
    headers: { Authorization: currentAuthToken ? `Bearer ${currentAuthToken}` : '' },
  });
  if (!response.ok) throw new Error(parseApiError(await response.text(), 'Failed to fetch referral info'));
  const data = await response.json();
  return {
    referral_code: data.referral_code ?? data.referralCode ?? '',
    referral_link: data.referral_link ?? data.referralLink ?? '',
  };
}

export async function regenerateReferralCode(
  distributorId: string,
): Promise<{ referral_code: string; message: string }> {
  const response = await fetch(
    `${API_BASE_URL}/api/referral/${encodeURIComponent(distributorId)}/regenerate`,
    {
      method: 'PUT',
      headers: { Authorization: currentAuthToken ? `Bearer ${currentAuthToken}` : '' },
    },
  );
  if (!response.ok) throw new Error(parseApiError(await response.text(), 'Failed to regenerate referral code'));
  return response.json();
}

// ── Notifications ─────────────────────────────────────────────────────────────

export async function getMyNotifications(
  unreadOnly?: boolean,
): Promise<Notification[]> {
  const url = unreadOnly
    ? `${API_BASE_URL}/api/notifications?unread=true`
    : `${API_BASE_URL}/api/notifications`;
  const response = await fetch(url, {
    headers: { Authorization: currentAuthToken ? `Bearer ${currentAuthToken}` : '' },
  });
  if (!response.ok) throw new Error(parseApiError(await response.text(), 'Failed to fetch notifications'));
  const data = await response.json();
  // Backend may return a raw array or a paginated { notifications: [...] } wrapper —
  // handle both so the screen never receives a non-array.
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.notifications)) return data.notifications;
  return [];
}

export async function getNotificationUnreadCount(): Promise<{ count: number }> {
  const response = await fetch(`${API_BASE_URL}/api/notifications/unread-count`, {
    headers: { Authorization: currentAuthToken ? `Bearer ${currentAuthToken}` : '' },
  });
  if (!response.ok) throw new Error(parseApiError(await response.text(), 'Failed to fetch unread count'));
  return response.json();
}

export async function markNotificationRead(id: string): Promise<void> {
  const response = await fetch(
    `${API_BASE_URL}/api/notifications/${encodeURIComponent(id)}/read`,
    {
      method: 'PUT',
      headers: { Authorization: currentAuthToken ? `Bearer ${currentAuthToken}` : '' },
    },
  );
  if (!response.ok) throw new Error(parseApiError(await response.text(), 'Failed to mark notification read'));
}

export async function markAllNotificationsRead(): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/notifications/read-all`, {
    method: 'PUT',
    headers: { Authorization: currentAuthToken ? `Bearer ${currentAuthToken}` : '' },
  });
  if (!response.ok) throw new Error(parseApiError(await response.text(), 'Failed to mark all notifications read'));
}

// ── Training Academy ──────────────────────────────────────────────────────────

export async function listTrainingCategories(): Promise<TrainingCategory[]> {
  const response = await fetch(`${API_BASE_URL}/api/training/categories`, {
    headers: { Authorization: currentAuthToken ? `Bearer ${currentAuthToken}` : '' },
  });
  if (!response.ok) throw new Error(parseApiError(await response.text(), 'Failed to fetch training categories'));
  return response.json();
}

export async function listMaterialsByCategory(
  categoryId: string,
): Promise<TrainingMaterial[]> {
  const response = await fetch(
    `${API_BASE_URL}/api/training/categories/${encodeURIComponent(categoryId)}/materials`,
    {
      headers: { Authorization: currentAuthToken ? `Bearer ${currentAuthToken}` : '' },
    },
  );
  if (!response.ok) throw new Error(parseApiError(await response.text(), 'Failed to fetch training materials'));
  return response.json();
}

export async function createTrainingCategory(data: {
  name: string;
  description?: string;
  sort_order?: number;
}): Promise<TrainingCategory> {
  const response = await fetch(`${API_BASE_URL}/api/training/categories`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: currentAuthToken ? `Bearer ${currentAuthToken}` : '',
    },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error(parseApiError(await response.text(), 'Failed to create training category'));
  return response.json();
}

export async function updateTrainingCategory(
  id: string,
  data: { name?: string; description?: string; sort_order?: number },
): Promise<TrainingCategory> {
  const response = await fetch(
    `${API_BASE_URL}/api/training/categories/${encodeURIComponent(id)}`,
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: currentAuthToken ? `Bearer ${currentAuthToken}` : '',
      },
      body: JSON.stringify(data),
    },
  );
  if (!response.ok) throw new Error(parseApiError(await response.text(), 'Failed to update training category'));
  return response.json();
}

export async function createTrainingMaterial(data: {
  category_id: string;
  title: string;
  description?: string;
  pdf_url: string;
}): Promise<TrainingMaterial> {
  const response = await fetch(`${API_BASE_URL}/api/training/materials`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: currentAuthToken ? `Bearer ${currentAuthToken}` : '',
    },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error(parseApiError(await response.text(), 'Failed to create training material'));
  return response.json();
}

export async function deactivateTrainingMaterial(id: string): Promise<void> {
  const response = await fetch(
    `${API_BASE_URL}/api/training/materials/${encodeURIComponent(id)}`,
    {
      method: 'DELETE',
      headers: { Authorization: currentAuthToken ? `Bearer ${currentAuthToken}` : '' },
    },
  );
  if (!response.ok) throw new Error(parseApiError(await response.text(), 'Failed to deactivate material'));
}

// ── Events ────────────────────────────────────────────────────────────────────

export async function listUpcomingEvents(type?: EventType): Promise<Event[]> {
  const url = type
    ? `${API_BASE_URL}/api/events?event_type=${encodeURIComponent(type)}`
    : `${API_BASE_URL}/api/events`;
  const response = await fetch(url, {
    headers: { Authorization: currentAuthToken ? `Bearer ${currentAuthToken}` : '' },
  });
  if (!response.ok) throw new Error(parseApiError(await response.text(), 'Failed to fetch upcoming events'));
  return response.json();
}

export async function listPastEvents(): Promise<Event[]> {
  const response = await fetch(`${API_BASE_URL}/api/events/past`, {
    headers: { Authorization: currentAuthToken ? `Bearer ${currentAuthToken}` : '' },
  });
  if (!response.ok) throw new Error(parseApiError(await response.text(), 'Failed to fetch past events'));
  return response.json();
}

export async function createEvent(data: {
  title: string;
  description?: string;
  event_type: EventType;
  location?: string;
  is_online?: boolean;
  meeting_note?: string;
  start_at: string;
  end_at: string;
  banner_image_url?: string;
}): Promise<Event> {
  const response = await fetch(`${API_BASE_URL}/api/events`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: currentAuthToken ? `Bearer ${currentAuthToken}` : '',
    },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error(parseApiError(await response.text(), 'Failed to create event'));
  return response.json();
}

export async function updateEvent(
  id: string,
  data: Partial<{
    title: string;
    description: string;
    event_type: EventType;
    location: string;
    is_online: boolean;
    meeting_note: string;
    start_at: string;
    end_at: string;
    banner_image_url: string;
  }>,
): Promise<Event> {
  const response = await fetch(`${API_BASE_URL}/api/events/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: currentAuthToken ? `Bearer ${currentAuthToken}` : '',
    },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error(parseApiError(await response.text(), 'Failed to update event'));
  return response.json();
}

export async function deactivateEvent(id: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/events/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: { Authorization: currentAuthToken ? `Bearer ${currentAuthToken}` : '' },
  });
  if (!response.ok) throw new Error(parseApiError(await response.text(), 'Failed to deactivate event'));
}

// ── Loyalty Points ────────────────────────────────────────────────────────────

export async function getMyLoyalty(page = 1, limit = 20): Promise<LoyaltyData> {
  const response = await fetch(
    `${API_BASE_URL}/api/loyalty/me?page=${page}&limit=${limit}`,
    {
      headers: { Authorization: currentAuthToken ? `Bearer ${currentAuthToken}` : '' },
    },
  );
  if (!response.ok) throw new Error(parseApiError(await response.text(), 'Failed to fetch loyalty data'));
  return response.json();
}

// ── Audit Logs ────────────────────────────────────────────────────────────────

export async function getAuditLogs(
  filters?: {
    entity_type?: string;
    actor_id?: string;
    date_from?: string;
    date_to?: string;
  },
  page = 1,
  limit = 20,
): Promise<{ entries: AuditLogEntry[]; total: number; page: number; limit: number }> {
  const params = new URLSearchParams();
  params.set('page', String(page));
  params.set('limit', String(limit));
  if (filters?.entity_type) params.set('entity_type', filters.entity_type);
  if (filters?.actor_id) params.set('actor_id', filters.actor_id);
  if (filters?.date_from) params.set('date_from', filters.date_from);
  if (filters?.date_to) params.set('date_to', filters.date_to);

  const response = await fetch(`${API_BASE_URL}/api/audit-log?${params.toString()}`, {
    headers: { Authorization: currentAuthToken ? `Bearer ${currentAuthToken}` : '' },
  });
  if (!response.ok) throw new Error(parseApiError(await response.text(), 'Failed to fetch audit logs'));
  return response.json();
}

// ── Manual Bonuses ────────────────────────────────────────────────────────────

export async function awardManualBonus(data: {
  distributorId: string;
  bonusCategory: 'leadership' | 'rank_achievement' | 'monthly_performance' | 'other';
  amount: number;
  note?: string;
}): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/manual-bonuses`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: currentAuthToken ? `Bearer ${currentAuthToken}` : '',
    },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error(parseApiError(await response.text(), 'Failed to award manual bonus'));
}

export async function listAllManualBonuses(filters?: {
  category?: string;
  distributorId?: string;
  page?: number;
  limit?: number;
}): Promise<any[]> {
  const params = new URLSearchParams();
  if (filters?.category) params.set('category', filters.category);
  if (filters?.distributorId) params.set('distributorId', filters.distributorId);
  if (filters?.page) params.set('page', String(filters.page));
  if (filters?.limit) params.set('limit', String(filters.limit));

  const response = await fetch(
    `${API_BASE_URL}/api/manual-bonuses?${params.toString()}`,
    {
      headers: { Authorization: currentAuthToken ? `Bearer ${currentAuthToken}` : '' },
    },
  );
  if (!response.ok) throw new Error(parseApiError(await response.text(), 'Failed to fetch manual bonuses'));
  return response.json();
}
// ── Products: admin CRUD ──────────────────────────────────────────────────────

export interface AdminProductPrice {
  countryId: string;
  countryName: string;
  currencyCode: string;
  price: number;
  distributorPrice: number;
  isAvailable: boolean;
}

export interface AdminProduct {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  isActive: boolean;
  pv: number;
  pricing: AdminProductPrice[];
}

export async function listProductsForAdmin(): Promise<AdminProduct[]> {
  const response = await fetch(`${API_BASE_URL}/api/products/admin/list`, {
    headers: { Authorization: currentAuthToken ? `Bearer ${currentAuthToken}` : '' },
  });
  if (!response.ok) throw new Error(parseApiError(await response.text(), 'Failed to list products'));
  return response.json();
}

export async function getProductForAdmin(id: string): Promise<AdminProduct> {
  const response = await fetch(`${API_BASE_URL}/api/products/${encodeURIComponent(id)}/admin`, {
    headers: { Authorization: currentAuthToken ? `Bearer ${currentAuthToken}` : '' },
  });
  if (!response.ok) throw new Error(parseApiError(await response.text(), 'Failed to fetch product'));
  return response.json();
}

export async function updateProduct(
  id: string,
  input: {
    name?: string;
    description?: string;
    imageUrl?: string;
    pv?: number;
    prices?: Array<{ countryId: string; price: number; distributorPrice: number; isAvailable: boolean }>;
  },
): Promise<AdminProduct> {
  const response = await fetch(`${API_BASE_URL}/api/products/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: currentAuthToken ? `Bearer ${currentAuthToken}` : '',
    },
    body: JSON.stringify(input),
  });
  if (!response.ok) throw new Error(parseApiError(await response.text(), 'Failed to update product'));
  return response.json();
}

export async function deactivateProduct(id: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/products/${encodeURIComponent(id)}/deactivate`, {
    method: 'PATCH',
    headers: { Authorization: currentAuthToken ? `Bearer ${currentAuthToken}` : '' },
  });
  if (!response.ok) throw new Error(parseApiError(await response.text(), 'Failed to deactivate product'));
}

// ── Countries: edit/deactivate (admin CRUD) ───────────────────────────────────

export async function updateCountry(
  id: string,
  input: Partial<{ name: string; isoCode: string; currencyCode: string; isActive: boolean }>,
): Promise<Country> {
  const response = await fetch(`${API_BASE_URL}/api/countries/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: currentAuthToken ? `Bearer ${currentAuthToken}` : '',
    },
    body: JSON.stringify(input),
  });
  if (!response.ok) throw new Error(parseApiError(await response.text(), 'Failed to update country'));
  return response.json();
}

export async function deactivateCountry(id: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/countries/${encodeURIComponent(id)}/deactivate`, {
    method: 'PATCH',
    headers: { Authorization: currentAuthToken ? `Bearer ${currentAuthToken}` : '' },
  });
  if (!response.ok) throw new Error(parseApiError(await response.text(), 'Failed to deactivate country'));
}

// ── Articles: edit/delete (admin CRUD) ────────────────────────────────────────

export async function updateArticle(
  id: string,
  article: Partial<Pick<Article, 'title' | 'summary' | 'content' | 'imageUrl'>>,
): Promise<Article> {
  const body: Record<string, unknown> = {};
  if (article.title !== undefined) body.title = article.title.trim();
  if (article.summary !== undefined || article.content !== undefined) {
    // Backend has a single `body` field — same combine pattern as createArticle.
    const summary = article.summary?.trim() ?? '';
    const content = article.content?.trim() ?? '';
    body.body = summary && content ? `${summary}\n\n${content}` : content || summary;
  }
  if (article.imageUrl !== undefined) body.coverImageUrl = article.imageUrl ?? null;

  const response = await fetch(`${API_BASE_URL}/api/articles/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: currentAuthToken ? `Bearer ${currentAuthToken}` : '',
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(parseApiError(await response.text(), 'Failed to update article'));

  const row = (await response.json()) as {
    id: string;
    title: string;
    body: string;
    coverImageUrl: string | null;
    createdAt: string;
  };
  return mapApiArticle(row);
}

export async function deleteArticle(id: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/articles/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: { Authorization: currentAuthToken ? `Bearer ${currentAuthToken}` : '' },
  });
  if (!response.ok) throw new Error(parseApiError(await response.text(), 'Failed to delete article'));
}

// ── News: edit/delete (admin CRUD) ────────────────────────────────────────────

export async function updateNewsPost(
  id: string,
  post: Partial<Pick<NewsPost, 'title' | 'excerpt' | 'content' | 'imageUrl'>>,
): Promise<NewsPost> {
  const body: Record<string, unknown> = {};
  if (post.title !== undefined) body.title = post.title.trim();
  if (post.excerpt !== undefined || post.content !== undefined) {
    const excerpt = post.excerpt?.trim() ?? '';
    const content = post.content?.trim() ?? '';
    body.body = excerpt && content ? `${excerpt}\n\n${content}` : content || excerpt;
  }
  if (post.imageUrl !== undefined) body.coverImageUrl = post.imageUrl ?? null;

  const response = await fetch(`${API_BASE_URL}/api/news/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: currentAuthToken ? `Bearer ${currentAuthToken}` : '',
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(parseApiError(await response.text(), 'Failed to update news'));

  const row = (await response.json()) as {
    id: string;
    title: string;
    body: string;
    coverImageUrl: string | null;
    createdAt: string;
  };
  return mapApiNews(row);
}

export async function deleteNewsPost(id: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/news/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: { Authorization: currentAuthToken ? `Bearer ${currentAuthToken}` : '' },
  });
  if (!response.ok) throw new Error(parseApiError(await response.text(), 'Failed to delete news'));
}

// ── Sellers: edit/deactivate/hard-delete (admin CRUD) ─────────────────────────

export async function updateSeller(
  id: string,
  input: Partial<{ fullName: string; phoneNumber: string; countryId: string }>,
): Promise<Distributor> {
  const response = await fetch(`${API_BASE_URL}/api/sellers/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: currentAuthToken ? `Bearer ${currentAuthToken}` : '',
    },
    body: JSON.stringify(input),
  });
  if (!response.ok) throw new Error(parseApiError(await response.text(), 'Failed to update distributor'));

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

export async function deactivateSeller(id: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/sellers/${encodeURIComponent(id)}/deactivate`, {
    method: 'PATCH',
    headers: { Authorization: currentAuthToken ? `Bearer ${currentAuthToken}` : '' },
  });
  if (!response.ok) throw new Error(parseApiError(await response.text(), 'Failed to deactivate distributor'));
}

export async function hardDeleteSeller(id: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/sellers/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: { Authorization: currentAuthToken ? `Bearer ${currentAuthToken}` : '' },
  });
  if (!response.ok) throw new Error(parseApiError(await response.text(), 'Failed to delete distributor'));
}

export async function activateCountry(id: string): Promise<Country> {
  const response = await fetch(`${API_BASE_URL}/api/countries/${encodeURIComponent(id)}/activate`, {
    method: 'PATCH',
    headers: { Authorization: currentAuthToken ? `Bearer ${currentAuthToken}` : '' },
  });
  if (!response.ok) throw new Error(parseApiError(await response.text(), 'Failed to activate country'));
  return response.json();
}

export async function activateSeller(id: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/sellers/${encodeURIComponent(id)}/activate`, {
    method: 'PATCH',
    headers: { Authorization: currentAuthToken ? `Bearer ${currentAuthToken}` : '' },
  });
  if (!response.ok) throw new Error(parseApiError(await response.text(), 'Failed to activate distributor'));
}

export async function activateProduct(id: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/products/${encodeURIComponent(id)}/activate`, {
    method: 'PATCH',
    headers: { Authorization: currentAuthToken ? `Bearer ${currentAuthToken}` : '' },
  });
  if (!response.ok) throw new Error(parseApiError(await response.text(), 'Failed to activate product'));
}

export async function deleteUploadedAsset(
  url: string,
  resourceType: 'image' | 'raw' = 'image',
): Promise<void> {
  try {
    await fetch(`${API_BASE_URL}/api/uploads/delete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: currentAuthToken ? `Bearer ${currentAuthToken}` : '',
      },
      body: JSON.stringify({ url, resourceType }),
    });
    // Best-effort cleanup — don't throw on failure, it shouldn't block the
    // admin's actual save/navigation action.
  } catch {
    // silently ignore
  }
}

// ── Pay Later ──────────────────────────────────────────────────────────────

export async function submitPayLaterOrder(
  country: string,
  items: OrderItem[],
): Promise<Order> {
  const response = await fetch(`${API_BASE_URL}/api/orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: currentAuthToken ? `Bearer ${currentAuthToken}` : '',
    },
    body: JSON.stringify({
      countryId: country,
      items: items.map((i) => ({
        productId: i.productId,
        quantity: i.quantity,
      })),
    }),
  });

  if (!response.ok) {
    throw new Error(parseApiError(await response.text(), 'Failed to submit order'));
  }

  return response.json();
}

export interface AwaitingPaymentOrder extends Order {
  buyerName?: string;
  distributorId?: string;
}

export async function getAwaitingPaymentOrders(): Promise<AwaitingPaymentOrder[]> {
  const response = await fetch(`${API_BASE_URL}/api/orders/awaiting-payment`, {
    headers: { Authorization: currentAuthToken ? `Bearer ${currentAuthToken}` : '' },
  });
  if (!response.ok) throw new Error(parseApiError(await response.text(), 'Failed to fetch awaiting-payment orders'));
  return response.json();
}

export async function markOrderPaidManually(
  orderId: string,
  method: 'cash' | 'bank_transfer' | 'mobile_money' = 'cash',
  note?: string,
): Promise<void> {
  const response = await fetch(
    `${API_BASE_URL}/api/payments/awaiting/${encodeURIComponent(orderId)}/mark-paid`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: currentAuthToken ? `Bearer ${currentAuthToken}` : '',
      },
      body: JSON.stringify({ method, note }),
    },
  );
  if (!response.ok) throw new Error(parseApiError(await response.text(), 'Failed to mark order as paid'));
}

export async function listCountriesForAdmin(): Promise<Country[]> {
  const response = await fetch(`${API_BASE_URL}/api/countries/admin/list`, {
    headers: { Authorization: currentAuthToken ? `Bearer ${currentAuthToken}` : '' },
  });
  if (!response.ok) throw new Error(parseApiError(await response.text(), 'Failed to list countries'));
  const rows = (await response.json()) as Array<{
    id: string; name: string; isoCode: string; currencyCode: string; isActive: boolean; createdAt: string;
  }>;
  return rows.map((c) => ({
    id: c.id, name: c.name, isoCode: c.isoCode, currencyCode: c.currencyCode,
    isActive: c.isActive, createdAt: c.createdAt,
  }));
}

export async function deleteTrainingCategory(id: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/training/categories/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: { Authorization: currentAuthToken ? `Bearer ${currentAuthToken}` : '' },
  });
  if (!response.ok) throw new Error(parseApiError(await response.text(), 'Failed to delete category'));
}

export async function hardDeleteTrainingMaterial(id: string): Promise<void> {
  const response = await fetch(
    `${API_BASE_URL}/api/training/materials/${encodeURIComponent(id)}/permanent`,
    {
      method: 'DELETE',
      headers: { Authorization: currentAuthToken ? `Bearer ${currentAuthToken}` : '' },
    },
  );
  if (!response.ok) throw new Error(parseApiError(await response.text(), 'Failed to delete material'));
}

export async function hardDeleteEvent(id: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/events/${encodeURIComponent(id)}/permanent`, {
    method: 'DELETE',
    headers: { Authorization: currentAuthToken ? `Bearer ${currentAuthToken}` : '' },
  });
  if (!response.ok) throw new Error(parseApiError(await response.text(), 'Failed to delete event'));
}

export async function getCloudinarySignature(
  resourceType: 'image' | 'raw' = 'image',
): Promise<{
  signature: string;
  timestamp: number;
  apiKey: string;
  cloudName: string;
  transformation: string;
}> {
  const response = await fetch(
    `${API_BASE_URL}/api/uploads/cloudinary-signature?resourceType=${resourceType}`,
    {
      headers: {
        Authorization: currentAuthToken ? `Bearer ${currentAuthToken}` : '',
      },
    },
  );

  if (!response.ok) {
    throw new Error(parseApiError(await response.text(), 'Failed to get upload signature'));
  }

  return response.json();
}

/**
 * Uploads a local file URI to Cloudinary using a signed request from the API.
 * resourceType 'image' (default) works for photos; 'raw' works for PDFs and
 * other non-image files. Returns the secure CDN URL.
 */
export async function uploadImage(
  localUri: string,
  folderHint = 'upload',
  resourceType: 'image' | 'raw' = 'image',
): Promise<string> {
  const sig = await getCloudinarySignature(resourceType);
  const form = new FormData();

  const filename = localUri.split('/').pop() ?? `${folderHint}-${Date.now()}`;
  const ext = filename.split('.').pop()?.toLowerCase();
  const type =
    resourceType === 'raw'
      ? 'application/pdf'
      : ext === 'png'
      ? 'image/png'
      : ext === 'webp'
      ? 'image/webp'
      : 'image/jpeg';

  form.append('file', {
    uri: localUri,
    name: filename,
    type,
  } as unknown as Blob);
  form.append('api_key', sig.apiKey);
  form.append('timestamp', String(sig.timestamp));
  form.append('signature', sig.signature);
  if (sig.transformation) {
    form.append('transformation', sig.transformation);
  }

  const uploadUrl = `https://api.cloudinary.com/v1_1/${sig.cloudName}/${resourceType}/upload`;

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', uploadUrl);

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const result = JSON.parse(xhr.responseText) as { secure_url?: string; error?: { message?: string } };
          if (result.secure_url) {
            resolve(result.secure_url);
          } else {
            reject(new Error(result.error?.message || 'Upload failed'));
          }
        } catch {
          reject(new Error('Failed to parse upload response'));
        }
      } else {
        try {
          const result = JSON.parse(xhr.responseText) as { error?: { message?: string } };
          reject(new Error(result.error?.message || `Upload failed with status ${xhr.status}`));
        } catch {
          reject(new Error(`Upload failed with status ${xhr.status}`));
        }
      }
    };

    xhr.onerror = () => {
      reject(new Error('Network request failed'));
    };

    xhr.send(form);
  });
}

/** @deprecated Prefer uploadImage — kept for existing product callers */
export async function uploadProductImage(localUri: string): Promise<string> {
  return uploadImage(localUri, 'product');
}

export interface CompanyOverview {
  totalSales: number;
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
  orderCount: number;
}

export interface ProductPerformance {
  productId: string;
  productName: string;
  unitsSold: number;
  totalRevenue: number;
}

export async function getCompanyOverview(): Promise<CompanyOverview> {
  const response = await fetch(`${API_BASE_URL}/api/analytics/admin/company-overview`, {
    headers: { Authorization: currentAuthToken ? `Bearer ${currentAuthToken}` : '' },
  });
  if (!response.ok) throw new Error(parseApiError(await response.text(), 'Failed to fetch company overview'));
  return response.json();
}

export async function getCountryPerformance(): Promise<CountryPerformance[]> {
  const response = await fetch(`${API_BASE_URL}/api/analytics/admin/country-performance`, {
    headers: { Authorization: currentAuthToken ? `Bearer ${currentAuthToken}` : '' },
  });
  if (!response.ok) throw new Error(parseApiError(await response.text(), 'Failed to fetch country performance'));
  return response.json();
}

export async function getProductPerformance(): Promise<ProductPerformance[]> {
  const response = await fetch(`${API_BASE_URL}/api/analytics/admin/product-performance`, {
    headers: { Authorization: currentAuthToken ? `Bearer ${currentAuthToken}` : '' },
  });
  if (!response.ok) throw new Error(parseApiError(await response.text(), 'Failed to fetch product performance'));
  return response.json();
}
