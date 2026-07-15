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
        joinDate: '',
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

export async function getArticles(): Promise<Article[]> {
  const response = await fetch(`${API_BASE_URL}/api/articles`, {
    headers: {
      Authorization: currentAuthToken ? `Bearer ${currentAuthToken}` : '',
    },
  });

  if (!response.ok) {
    throw new Error(parseApiError(await response.text(), 'Failed to fetch articles'));
  }

  return await response.json();
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

  return await response.json();
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

export async function getCloudinarySignature(): Promise<{
  signature: string;
  timestamp: number;
  apiKey: string;
  cloudName: string;
  transformation: string;
}> {
  const response = await fetch(`${API_BASE_URL}/api/uploads/cloudinary-signature`, {
    headers: {
      Authorization: currentAuthToken ? `Bearer ${currentAuthToken}` : '',
    },
  });

  if (!response.ok) {
    throw new Error(parseApiError(await response.text(), 'Failed to get upload signature'));
  }

  return response.json();
}

/**
 * Uploads a local image URI to Cloudinary using a signed request from the API.
 * Returns the secure CDN URL (works for products, news, articles).
 */
export async function uploadImage(localUri: string, folderHint = 'upload'): Promise<string> {
  const sig = await getCloudinarySignature();
  const form = new FormData();

  const filename = localUri.split('/').pop() ?? `${folderHint}-${Date.now()}.jpg`;
  const ext = filename.split('.').pop()?.toLowerCase() ?? 'jpg';
  const type = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';

  form.append('file', {
    uri: localUri,
    name: filename,
    type,
  } as unknown as Blob);
  form.append('api_key', sig.apiKey);
  form.append('timestamp', String(sig.timestamp));
  form.append('signature', sig.signature);
  form.append('transformation', sig.transformation);

  const uploadUrl = `https://api.cloudinary.com/v1_1/${sig.cloudName}/image/upload`;

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
            reject(new Error(result.error?.message || 'Image upload failed'));
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
