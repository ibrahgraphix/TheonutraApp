import type {
  Article,
  Commission,
  Distributor,
  NewsPost,
  Order,
  Payment,
  Product,
  TeamMember,
} from '../types';

export const MOCK_PASSWORD = 'password123';

const joinDates: Record<string, string> = {
  'dist-001': '2024-01-15',
  'dist-002': '2024-03-20',
  'dist-003': '2024-04-10',
  'dist-004': '2024-06-05',
  'dist-005': '2024-08-12',
  'dist-006': '2024-08-18',
  'dist-007': '2024-09-01',
  'dist-008': '2024-09-15',
  'dist-009': '2025-01-10',
  'dist-010': '2025-02-14',
  'dist-011': '2025-04-22',
  'dist-012': '2025-05-08',
  'dist-013': '2025-06-30',
  'dist-014': '2025-09-12',
  'dist-015': '2025-11-20',
};

interface MockDistributorRecord extends Distributor {
  password: string;
}

export const mockDistributors: MockDistributorRecord[] = [
  {
    id: 'dist-001',
    distributorId: 'TN001',
    fullName: 'James Okafor',
    phone: '+234 801 234 5678',
    email: 'james.okafor@theonutra.com',
    role: 'admin',
    country: 'Nigeria',
    referredBy: null,
    password: MOCK_PASSWORD,
  },
  {
    id: 'dist-002',
    distributorId: 'TN002',
    fullName: 'Amara Nwosu',
    phone: '+234 802 345 6789',
    email: 'amara.nwosu@theonutra.com',
    role: 'company_staff',
    country: 'Nigeria',
    referredBy: 'dist-001',
    password: MOCK_PASSWORD,
  },
  {
    id: 'dist-003',
    distributorId: 'TN003',
    fullName: 'Kwame Mensah',
    phone: '+233 24 567 8901',
    email: 'kwame.mensah@theonutra.com',
    role: 'distributor',
    country: 'Ghana',
    referredBy: 'dist-001',
    password: MOCK_PASSWORD,
  },
  {
    id: 'dist-004',
    distributorId: 'TN004',
    fullName: 'Chioma Eze',
    phone: '+234 803 456 7890',
    email: 'chioma.eze@theonutra.com',
    role: 'distributor',
    country: 'Nigeria',
    referredBy: 'dist-001',
    password: MOCK_PASSWORD,
  },
  {
    id: 'dist-005',
    distributorId: 'TN005',
    fullName: 'Fatima Hassan',
    phone: '+254 712 345 678',
    email: 'fatima.hassan@theonutra.com',
    role: 'distributor',
    country: 'Kenya',
    referredBy: 'dist-002',
    password: MOCK_PASSWORD,
  },
  {
    id: 'dist-006',
    distributorId: 'TN006',
    fullName: 'David Kimani',
    phone: '+254 723 456 789',
    email: 'david.kimani@theonutra.com',
    role: 'distributor',
    country: 'Kenya',
    referredBy: 'dist-002',
    password: MOCK_PASSWORD,
  },
  {
    id: 'dist-007',
    distributorId: 'TN007',
    fullName: 'Grace Mbeki',
    phone: '+27 82 345 6789',
    email: 'grace.mbeki@theonutra.com',
    role: 'distributor',
    country: 'South Africa',
    referredBy: 'dist-003',
    password: MOCK_PASSWORD,
  },
  {
    id: 'dist-008',
    distributorId: 'TN008',
    fullName: 'Samuel Adeyemi',
    phone: '+234 805 678 9012',
    email: 'samuel.adeyemi@theonutra.com',
    role: 'distributor',
    country: 'Nigeria',
    referredBy: 'dist-003',
    password: MOCK_PASSWORD,
  },
  {
    id: 'dist-009',
    distributorId: 'TN009',
    fullName: 'Linda Osei',
    phone: '+233 20 123 4567',
    email: 'linda.osei@theonutra.com',
    role: 'distributor',
    country: 'Ghana',
    referredBy: 'dist-004',
    password: MOCK_PASSWORD,
  },
  {
    id: 'dist-010',
    distributorId: 'TN010',
    fullName: 'Peter Okonkwo',
    phone: '+234 806 789 0123',
    email: 'peter.okonkwo@theonutra.com',
    role: 'distributor',
    country: 'Nigeria',
    referredBy: 'dist-004',
    password: MOCK_PASSWORD,
  },
  {
    id: 'dist-011',
    distributorId: 'TN011',
    fullName: 'Ruth Akinyi',
    phone: '+254 734 567 890',
    email: 'ruth.akinyi@theonutra.com',
    role: 'distributor',
    country: 'Kenya',
    referredBy: 'dist-005',
    password: MOCK_PASSWORD,
  },
  {
    id: 'dist-012',
    distributorId: 'TN012',
    fullName: 'Michael Boateng',
    phone: '+233 24 678 9012',
    email: 'michael.boateng@theonutra.com',
    role: 'distributor',
    country: 'Ghana',
    referredBy: 'dist-006',
    password: MOCK_PASSWORD,
  },
  {
    id: 'dist-013',
    distributorId: 'TN013',
    fullName: 'Aisha Ibrahim',
    phone: '+27 83 456 7890',
    email: 'aisha.ibrahim@theonutra.com',
    role: 'distributor',
    country: 'South Africa',
    referredBy: 'dist-007',
    password: MOCK_PASSWORD,
  },
  {
    id: 'dist-014',
    distributorId: 'TN014',
    fullName: 'Emmanuel Uche',
    phone: '+234 807 890 1234',
    email: 'emmanuel.uche@theonutra.com',
    role: 'distributor',
    country: 'Nigeria',
    referredBy: 'dist-008',
    password: MOCK_PASSWORD,
  },
  {
    id: 'dist-015',
    distributorId: 'TN015',
    fullName: 'Blessing Oladele',
    phone: '+234 808 901 2345',
    email: 'blessing.oladele@theonutra.com',
    role: 'distributor',
    country: 'Nigeria',
    referredBy: 'dist-009',
    password: MOCK_PASSWORD,
  },
].map((d) => ({
  ...d,
  joinDate: joinDates[d.id] ?? '2025-01-01',
  password: d.password ?? MOCK_PASSWORD,
}));

const salesByDistributor: Record<string, { personal: number; team: number; bonus: number }> = {
  'dist-001': { personal: 12500, team: 89400, bonus: 4200 },
  'dist-002': { personal: 6800, team: 31200, bonus: 1850 },
  'dist-003': { personal: 7200, team: 28600, bonus: 1920 },
  'dist-004': { personal: 4250, team: 18600, bonus: 840 },
  'dist-005': { personal: 3100, team: 9800, bonus: 520 },
  'dist-006': { personal: 2800, team: 8400, bonus: 460 },
  'dist-007': { personal: 3500, team: 7200, bonus: 380 },
  'dist-008': { personal: 2900, team: 6500, bonus: 340 },
  'dist-009': { personal: 2100, team: 4200, bonus: 220 },
  'dist-010': { personal: 1800, team: 1800, bonus: 150 },
  'dist-011': { personal: 1200, team: 1200, bonus: 90 },
  'dist-012': { personal: 950, team: 950, bonus: 75 },
  'dist-013': { personal: 1100, team: 1100, bonus: 85 },
  'dist-014': { personal: 800, team: 800, bonus: 60 },
  'dist-015': { personal: 650, team: 650, bonus: 45 },
};

export const mockProducts: Product[] = [
  {
    id: 'prod-001',
    name: 'NutriBoost Green Complex',
    description:
      'Premium plant-based wellness supplement with spirulina, moringa, and green tea extract for daily vitality.',
    category: 'Supplements',
    pricing: [
      { country: 'Nigeria', price: 18500, currency: 'NGN', available: true },
      { country: 'Ghana', price: 320, currency: 'GHS', available: true },
      { country: 'Kenya', price: 4200, currency: 'KES', available: true },
    ],
  },
  {
    id: 'prod-002',
    name: 'Immune Shield Capsules',
    description:
      'Daily immune support with vitamin C, zinc, and natural antioxidants to help your body stay resilient.',
    category: 'Supplements',
    pricing: [
      { country: 'Nigeria', price: 14200, currency: 'NGN', available: true },
      { country: 'Ghana', price: 265, currency: 'GHS', available: true },
    ],
  },
  {
    id: 'prod-003',
    name: 'VitalCare Omega-3',
    description:
      'High-potency fish oil capsules supporting heart, brain, and joint health with EPA and DHA.',
    category: 'Nutrition',
    pricing: [
      { country: 'Nigeria', price: 16800, currency: 'NGN', available: true },
      { country: 'South Africa', price: 520, currency: 'ZAR', available: true },
    ],
  },
  {
    id: 'prod-004',
    name: 'Herbal Detox Tea',
    description:
      'A soothing blend of dandelion, ginger, and lemongrass to support natural cleansing and digestion.',
    category: 'Beverages',
    pricing: [
      { country: 'Ghana', price: 180, currency: 'GHS', available: true },
      { country: 'Kenya', price: 2400, currency: 'KES', available: true },
    ],
  },
  {
    id: 'prod-005',
    name: 'Energy Plus Tablets',
    description:
      'B-vitamin complex with ginseng for sustained energy without the crash. Ideal for active distributors.',
    category: 'Wellness',
    pricing: [{ country: 'Nigeria', price: 12500, currency: 'NGN', available: true }],
  },
  {
    id: 'prod-006',
    name: 'Collagen Beauty Blend',
    description:
      'Marine collagen with biotin and vitamin E for healthy skin, hair, and nails from within.',
    category: 'Beauty',
    pricing: [
      { country: 'Kenya', price: 5800, currency: 'KES', available: true },
      { country: 'South Africa', price: 680, currency: 'ZAR', available: true },
    ],
  },
  {
    id: 'prod-007',
    name: 'Probiotic Balance',
    description:
      '10-strain probiotic formula supporting gut health and nutrient absorption for overall wellness.',
    category: 'Supplements',
    pricing: [
      { country: 'Nigeria', price: 19800, currency: 'NGN', available: true },
      { country: 'Ghana', price: 350, currency: 'GHS', available: true },
      { country: 'Kenya', price: 5100, currency: 'KES', available: false },
    ],
  },
  {
    id: 'prod-008',
    name: 'Sleep Well Formula',
    description:
      'Natural sleep aid with melatonin, chamomile, and magnesium to promote restful, restorative sleep.',
    category: 'Wellness',
    pricing: [{ country: 'Ghana', price: 295, currency: 'GHS', available: true }],
  },
  {
    id: 'prod-009',
    name: 'Joint Support Complex',
    description:
      'Glucosamine, chondroitin, and turmeric for flexible joints and comfortable movement.',
    category: 'Supplements',
    pricing: [
      { country: 'Nigeria', price: 21500, currency: 'NGN', available: true },
      { country: 'Kenya', price: 6200, currency: 'KES', available: true },
    ],
  },
  {
    id: 'prod-010',
    name: 'Kids Multivitamin Gummies',
    description:
      'Delicious fruit-flavored gummies packed with essential vitamins for growing children ages 4+.',
    category: 'Kids',
    pricing: [
      { country: 'South Africa', price: 390, currency: 'ZAR', available: true },
      { country: 'Kenya', price: 3500, currency: 'KES', available: true },
    ],
  },
];

export const companyBankDetails = {
  bankName: 'Zenith Bank',
  accountName: 'Theonutra Ltd',
  accountNumber: '2087654321',
  branchCode: 'ZN-NG-001',
  swiftCode: 'ZEIBNGLA',
};

export const mockNews: NewsPost[] = [
  {
    id: 'news-001',
    title: 'NutriBoost Green Complex — Now Available Across Africa',
    excerpt:
      'Our flagship wellness supplement launches in Nigeria, Ghana, and Kenya with special distributor pricing.',
    content:
      'Theonutra is proud to announce the continental rollout of NutriBoost Green Complex, our flagship plant-based wellness supplement.\n\nDeveloped by our research team over 18 months, NutriBoost combines spirulina, moringa, and green tea extract in a single daily capsule designed to support energy, immunity, and overall vitality.\n\nDistributors can now order at introductory pricing through the Shop tab. Early adopters who place orders before July 31 will earn a 15% bonus on personal sales volume.\n\nContact your upline or regional manager for training materials and product brochures.',
    imageUrl: 'cover-green',
    publishedAt: '2026-07-01T10:00:00Z',
    isFeatured: true,
  },
  {
    id: 'news-002',
    title: 'Q2 2026 Leadership Summit — Lagos',
    excerpt:
      'Join top distributors for two days of training, networking, and recognition in Lagos this August.',
    content:
      'Mark your calendars for August 14–15, 2026. Theonutra\'s Q2 Leadership Summit returns to Lagos with keynote sessions from our founders, breakout workshops on team building, and an awards gala recognizing top performers.\n\nRegistration is open to all distributors with 3+ direct recruits. Company staff will host product demos and one-on-one coaching sessions.\n\nEarly-bird registration closes July 25. Register through your account manager.',
    imageUrl: 'cover-summit',
    publishedAt: '2026-06-20T09:00:00Z',
  },
  {
    id: 'news-003',
    title: 'Mobile Money Payments Now Supported',
    excerpt:
      'Checkout with M-Pesa, Tigo Pesa, or Airtel Money directly in the app.',
    content:
      'We\'ve expanded payment options to make ordering easier for distributors across East Africa. You can now pay via M-Pesa, Tigo Pesa, or Airtel Money at checkout.\n\nPayments remain pending until verified by our finance team — typically within 24 hours on business days.\n\nBank transfer remains available for all regions.',
    imageUrl: 'cover-mobile',
    publishedAt: '2026-06-05T14:30:00Z',
  },
  {
    id: 'news-004',
    title: 'New Compensation Plan Effective July 2026',
    excerpt:
      'Enhanced team bonuses and faster payout cycles for qualifying distributors.',
    content:
      'Starting July 1, 2026, Theonutra\'s compensation plan includes higher team volume bonuses at the Silver and Gold ranks, plus bi-weekly payout cycles for distributors who maintain active status.\n\nReview the full plan document in the Articles section. Your upline can walk you through how the changes affect your earnings.',
    imageUrl: 'cover-comp',
    publishedAt: '2026-05-28T11:00:00Z',
  },
  {
    id: 'news-005',
    title: 'Kenya Warehouse Opens — Faster Local Delivery',
    excerpt:
      'Orders to Kenya now ship from Nairobi with 2–3 day delivery.',
    content:
      'Our new Nairobi fulfillment center is operational. Kenyan distributors will experience significantly faster delivery times and reduced shipping costs on all product orders.\n\nGhana and South Africa regional hubs are planned for Q4 2026.',
    imageUrl: 'cover-warehouse',
    publishedAt: '2026-05-10T08:00:00Z',
  },
  {
    id: 'news-006',
    title: 'Welcome 500th Distributor to Theonutra Network',
    excerpt:
      'A milestone celebration for our growing pan-African wellness community.',
    content:
      'This month we welcomed our 500th active distributor to the Theonutra family. From a single office in Lagos to a network spanning six countries, this milestone reflects the dedication of every distributor building healthier communities.\n\nThank you for being part of our journey. Here\'s to the next 500.',
    imageUrl: 'cover-milestone',
    publishedAt: '2026-04-22T16:00:00Z',
  },
];

export const mockArticles: Article[] = [
  {
    id: 'art-001',
    title: 'Building a Sustainable Wellness Business',
    summary:
      'Practical strategies for growing your distributor network while maintaining trust and product quality.',
    content:
      'Building a sustainable wellness business is about more than sales targets — it\'s about creating genuine value for your customers and team.\n\n**Start with product knowledge.** Know every supplement in the catalog. Customers trust distributors who can explain ingredients, benefits, and proper usage.\n\n**Recruit intentionally.** Look for people who share your passion for health, not just income opportunity. Quality recruits build stronger teams.\n\n**Use the tools.** The Theonutra app gives you real-time sales data, team analytics, and training articles. Review your dashboard weekly.\n\n**Stay consistent.** The most successful distributors show up every day — sharing products, following up with customers, and supporting their downline.',
    imageUrl: 'cover-business',
    publishedAt: '2026-06-15T09:00:00Z',
    category: 'Business',
    author: 'Theonutra Team',
  },
  {
    id: 'art-002',
    title: '5 Daily Habits of Top-Performing Distributors',
    summary:
      'What separates consistent earners from occasional sellers? These five habits make the difference.',
    content:
      'After analyzing our top 50 distributors across Africa, clear patterns emerged.\n\n1. **Morning review** — Check your dashboard and set one goal for the day.\n2. **Customer follow-up** — Reach out to at least 3 customers or prospects daily.\n3. **Team touchpoint** — Message one downline member with encouragement or coaching.\n4. **Product demo** — Share one product tip on social media or in person.\n5. **Evening reflection** — Log what worked and what to improve tomorrow.\n\nSmall daily actions compound into significant monthly results.',
    imageUrl: 'cover-habits',
    publishedAt: '2026-06-01T10:00:00Z',
    category: 'Training',
    author: 'James Okafor',
  },
  {
    id: 'art-003',
    title: 'Understanding Your Monthly Bonus Structure',
    summary:
      'A clear breakdown of personal sales bonuses, team volume rewards, and rank advancement.',
    content:
      'Your monthly earnings come from three primary streams:\n\n**Personal Sales Bonus** — A percentage of your direct product sales, paid when orders are confirmed.\n\n**Team Volume Bonus** — Earned on sales generated by your downline, up to three levels deep.\n\n**Rank Advancement Bonus** — One-time rewards when you achieve Silver, Gold, or Platinum distributor status.\n\nBonuses are calculated on the 1st of each month for the prior month\'s confirmed sales. Pending orders do not count until payment is verified.',
    imageUrl: 'cover-bonus',
    publishedAt: '2026-05-18T11:00:00Z',
    category: 'Compensation',
    author: 'Theonutra Finance',
  },
  {
    id: 'art-004',
    title: 'Natural Science for Better Health: Our Formulation Philosophy',
    summary:
      'How Theonutra combines traditional herbal knowledge with modern nutritional science.',
    content:
      'Every Theonutra product begins with a simple question: how can nature and science work together to support human health?\n\nOur R&D team partners with certified labs to test ingredient purity, bioavailability, and safety. We source botanicals from sustainable farms and combine them with clinically studied nutrients.\n\nWe never use artificial fillers, and every batch is third-party tested. This commitment is why our distributors can recommend Theonutra products with confidence.',
    imageUrl: 'cover-science',
    publishedAt: '2026-05-02T09:30:00Z',
    category: 'Wellness',
    author: 'Dr. Adaeze Nwankwo',
  },
  {
    id: 'art-005',
    title: 'Social Media Tips for Distributor Success',
    summary:
      'Grow your reach ethically on Instagram, WhatsApp, and Facebook without spamming.',
    content:
      'Social media is a powerful tool for wellness distributors — when used authentically.\n\n**Share stories, not pitches.** Post about your own wellness journey and how products fit into it.\n\n**Educate first.** Carousel posts explaining ingredients outperform hard-sell posts 3:1.\n\n**Use WhatsApp groups wisely.** Create value-first groups with health tips, not product catalogs.\n\n**Be compliant.** Always disclose your distributor relationship and avoid medical claims.',
    imageUrl: 'cover-social',
    publishedAt: '2026-04-20T14:00:00Z',
    category: 'Marketing',
    author: 'Theonutra Marketing',
  },
  {
    id: 'art-006',
    title: 'Onboarding New Recruits: A Step-by-Step Guide',
    summary:
      'Help your new team members succeed in their first 30 days with this proven onboarding checklist.',
    content:
      'The first 30 days determine whether a new recruit becomes an active distributor or goes inactive.\n\n**Week 1:** Product training — have them try 2–3 core products personally.\n**Week 2:** App walkthrough — login, shop, team tab, and dashboard review.\n**Week 3:** First sale — accompany them on a customer conversation or demo.\n**Week 4:** Recruiting intro — discuss how they can share the opportunity with two contacts.\n\nSchedule a 15-minute check-in call at the end of each week. Your attention in month one pays dividends for years.',
    imageUrl: 'cover-onboard',
    publishedAt: '2026-04-05T08:00:00Z',
    category: 'Training',
    author: 'Amara Nwosu',
  },
];

const monthlyHistory: Record<string, Record<string, { personal: number; team: number; bonus: number }>> = {
  'dist-004': {
    '2026-07': { personal: 4250, team: 18600, bonus: 840 },
    '2026-06': { personal: 3800, team: 16200, bonus: 720 },
    '2026-05': { personal: 3200, team: 14100, bonus: 610 },
    '2026-04': { personal: 2900, team: 12800, bonus: 540 },
    '2026-03': { personal: 2400, team: 10500, bonus: 420 },
    '2026-02': { personal: 1800, team: 8200, bonus: 310 },
  },
};

const monthLabels: Record<string, string> = {
  '2026-07': 'July 2026',
  '2026-06': 'June 2026',
  '2026-05': 'May 2026',
  '2026-04': 'April 2026',
  '2026-03': 'March 2026',
  '2026-02': 'February 2026',
};

export function getMonthlyHistory(distributorId: string, month: string) {
  const history = monthlyHistory[distributorId];
  if (history?.[month]) return history[month];

  const sales = getSalesForDistributor(distributorId);
  const factor = 0.7 + (month.charCodeAt(6) % 5) * 0.06;
  return {
    personal: Math.round(sales.personal * factor),
    team: Math.round(sales.team * factor),
    bonus: Math.round(sales.bonus * factor),
  };
}

export function getAvailableMonths(distributorId: string): string[] {
  const history = monthlyHistory[distributorId];
  if (history) return Object.keys(history).sort().reverse();
  return Object.keys(monthLabels).sort().reverse();
}

export function getMonthLabel(month: string) {
  return monthLabels[month] ?? month;
}

export function getCurrencyForCountry(country: string) {
  const map: Record<string, string> = {
    Nigeria: 'NGN',
    Ghana: 'GHS',
    Kenya: 'KES',
    'South Africa': 'ZAR',
  };
  return map[country] ?? 'USD';
}

export function getSalesForDistributor(distributorId: string) {
  return (
    salesByDistributor[distributorId] ?? {
      personal: 0,
      team: 0,
      bonus: 0,
    }
  );
}

export function buildTeamTree(rootId: string): TeamMember[] {
  const children = mockDistributors.filter((d) => d.referredBy === rootId);

  return children.map((distributor) => {
    const sales = getSalesForDistributor(distributor.id);
    const grandchildren = buildTeamTree(distributor.id);
    const level = getDistributorLevel(distributor.id);

    return {
      distributor: stripPassword(distributor),
      level,
      personalSales: sales.personal,
      teamSales: sales.team,
      recruitsCount: grandchildren.length,
      children: grandchildren,
    };
  });
}

function getDistributorLevel(distributorId: string, current = 1): number {
  const distributor = mockDistributors.find((d) => d.id === distributorId);
  if (!distributor?.referredBy) {
    return current;
  }
  return getDistributorLevel(distributor.referredBy, current + 1);
}

export function stripPassword(distributor: MockDistributorRecord): Distributor {
  const { password: _password, ...rest } = distributor;
  return rest;
}

export function resolveProductForCountry(
  product: Product,
  country: string,
): ProductListing | null {
  const match = product.pricing.find(
    (p) => p.country.toLowerCase() === country.toLowerCase() && p.available,
  );
  if (!match) return null;

  return {
    ...product,
    price: match.price,
    currency: match.currency,
    available: match.available,
  };
}

export function getProductsForCountry(country: string): ProductListing[] {
  return mockProducts
    .map((p) => resolveProductForCountry(p, country))
    .filter((p): p is ProductListing => p !== null);
}

export function getProductCountries(): string[] {
  const countries = new Set<string>();
  for (const product of mockProducts) {
    for (const entry of product.pricing) {
      if (entry.available) {
        countries.add(entry.country);
      }
    }
  }
  return Array.from(countries).sort();
}

export const mockOrders: Order[] = [
  {
    id: 'ord-seed-001',
    distributorId: 'dist-004',
    country: 'Nigeria',
    items: [
      { productId: 'prod-001', productName: 'NutriBoost Green Complex', quantity: 2, unitPrice: 18500 },
      { productId: 'prod-002', productName: 'Immune Shield Capsules', quantity: 1, unitPrice: 14200 },
    ],
    total: 51200,
    currency: 'NGN',
    status: 'delivered',
    payment: { method: 'bank_transfer', reference: 'TXN-20260612-8821' },
    createdAt: '2026-06-12T14:20:00Z',
  },
  {
    id: 'ord-seed-002',
    distributorId: 'dist-004',
    country: 'Nigeria',
    items: [
      { productId: 'prod-005', productName: 'Energy Plus Tablets', quantity: 3, unitPrice: 12500 },
    ],
    total: 37500,
    currency: 'NGN',
    status: 'confirmed',
    payment: { method: 'mobile_money', provider: 'M-Pesa', phone: '+234 803 456 7890' },
    createdAt: '2026-06-28T09:15:00Z',
  },
  {
    id: 'ord-seed-003',
    distributorId: 'dist-003',
    country: 'Ghana',
    items: [
      { productId: 'prod-001', productName: 'NutriBoost Green Complex', quantity: 1, unitPrice: 320 },
      { productId: 'prod-004', productName: 'Herbal Detox Tea', quantity: 2, unitPrice: 180 },
    ],
    total: 680,
    currency: 'GHS',
    status: 'delivered',
    payment: { method: 'bank_transfer', reference: 'TXN-20260520-4412' },
    createdAt: '2026-05-20T11:00:00Z',
  },
  {
    id: 'ord-seed-004',
    distributorId: 'dist-005',
    country: 'Kenya',
    items: [
      { productId: 'prod-006', productName: 'Collagen Beauty Blend', quantity: 1, unitPrice: 5800 },
    ],
    total: 5800,
    currency: 'KES',
    status: 'shipped',
    payment: { method: 'mobile_money', provider: 'M-Pesa', phone: '+254 712 345 678' },
    createdAt: '2026-07-05T16:45:00Z',
  },
  {
    id: 'ord-seed-005',
    distributorId: 'dist-002',
    country: 'Nigeria',
    items: [
      { productId: 'prod-007', productName: 'Probiotic Balance', quantity: 2, unitPrice: 19800 },
    ],
    total: 39600,
    currency: 'NGN',
    status: 'pending_confirmation',
    payment: { method: 'bank_transfer', reference: 'TXN-20260710-9934' },
    createdAt: '2026-07-10T08:30:00Z',
  },
];

export const mockPayments: Payment[] = [
  {
    id: 'pay-seed-001',
    orderId: 'ord-seed-005',
    distributorId: 'dist-002',
    amount: 39600,
    currency: 'NGN',
    method: 'bank_transfer',
    status: 'pending',
    reference: 'TXN-20260710-9934',
    createdAt: '2026-07-10T08:30:00Z',
  },
  {
    id: 'pay-seed-002',
    orderId: 'ord-pending-001',
    distributorId: 'dist-009',
    amount: 21000,
    currency: 'NGN',
    method: 'bank_transfer',
    status: 'pending',
    reference: 'TXN-20260711-7723',
    createdAt: '2026-07-11T10:00:00Z',
  },
  {
    id: 'pay-seed-003',
    orderId: 'ord-pending-002',
    distributorId: 'dist-006',
    amount: 8400,
    currency: 'KES',
    method: 'mobile_money',
    status: 'pending',
    provider: 'M-Pesa',
    phone: '+254 723 456 789',
    createdAt: '2026-07-12T13:20:00Z',
  },
  {
    id: 'pay-seed-004',
    orderId: 'ord-pending-003',
    distributorId: 'dist-012',
    amount: 640,
    currency: 'GHS',
    method: 'mobile_money',
    status: 'pending',
    provider: 'Tigo Pesa',
    phone: '+233 24 678 9012',
    createdAt: '2026-07-12T15:45:00Z',
  },
];
export const mockCommissions: Commission[] = [];
