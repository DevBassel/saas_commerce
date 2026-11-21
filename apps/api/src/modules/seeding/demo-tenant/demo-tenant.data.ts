import { Faker, en } from '@faker-js/faker';

export const DEMO_CUSTOMER_PASSWORD = '11223344';
export const DEMO_CUSTOMER_COUNT = 10;
export const DEMO_CATEGORY_COUNT = 7;
export const DEMO_PRODUCT_COUNT = 20;
export const DEMO_IMAGES_PER_PRODUCT = 4;

export interface DemoCustomerSeed {
  name: string;
  email: string;
  phone: string;
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

export interface DemoCategorySeed {
  name: string;
  slug: string;
  description: string;
  isActive: boolean;
}

export interface DemoProductSeed {
  name: string;
  sku: string;
  slug: string;
  description: string;
  price: number;
  stock: number;
  isActive: boolean;
  categorySlug: string;
  imageBackground: string;
  imageAccent: string;
}

export interface DemoSeedData {
  customers: DemoCustomerSeed[];
  categories: DemoCategorySeed[];
  products: DemoProductSeed[];
}

export interface DemoTenantIdentity {
  name: string;
  slug: string;
}

interface ProductTemplate {
  name: string;
  slug: string;
  categorySlug: string;
  basePrice: number;
  imageBackground: string;
  imageAccent: string;
}

export const DEMO_CATEGORY_TEMPLATES = [
  { name: 'Electronics', slug: 'electronics' },
  { name: 'Fashion', slug: 'fashion' },
  { name: 'Home & Living', slug: 'home-living' },
  { name: 'Sports & Outdoors', slug: 'sports-outdoors' },
  { name: 'Beauty & Personal Care', slug: 'beauty-personal-care' },
  { name: 'Accessories', slug: 'accessories' },
  { name: 'Gaming', slug: 'gaming' },
] as const;

export const DEMO_PRODUCT_TEMPLATES: ProductTemplate[] = [
  {
    name: 'Wireless ANC Headphones',
    slug: 'wireless-anc-headphones',
    categorySlug: 'electronics',
    basePrice: 179,
    imageBackground: '#101827',
    imageAccent: '#38bdf8',
  },
  {
    name: 'Smart Home Hub',
    slug: 'smart-home-hub',
    categorySlug: 'electronics',
    basePrice: 129,
    imageBackground: '#172554',
    imageAccent: '#818cf8',
  },
  {
    name: 'Portable 4K Projector',
    slug: 'portable-4k-projector',
    categorySlug: 'electronics',
    basePrice: 449,
    imageBackground: '#111827',
    imageAccent: '#f59e0b',
  },
  {
    name: 'Classic Denim Jacket',
    slug: 'classic-denim-jacket',
    categorySlug: 'fashion',
    basePrice: 89,
    imageBackground: '#1e3a5f',
    imageAccent: '#93c5fd',
  },
  {
    name: 'Everyday Knit Sneakers',
    slug: 'everyday-knit-sneakers',
    categorySlug: 'fashion',
    basePrice: 74,
    imageBackground: '#292524',
    imageAccent: '#fb7185',
  },
  {
    name: 'Linen Blend Overshirt',
    slug: 'linen-blend-overshirt',
    categorySlug: 'fashion',
    basePrice: 68,
    imageBackground: '#3f3f2f',
    imageAccent: '#d9f99d',
  },
  {
    name: 'Ceramic Table Lamp',
    slug: 'ceramic-table-lamp',
    categorySlug: 'home-living',
    basePrice: 96,
    imageBackground: '#422006',
    imageAccent: '#fcd34d',
  },
  {
    name: 'Textured Throw Blanket',
    slug: 'textured-throw-blanket',
    categorySlug: 'home-living',
    basePrice: 58,
    imageBackground: '#4c1d2f',
    imageAccent: '#f9a8d4',
  },
  {
    name: 'Oak Serving Board',
    slug: 'oak-serving-board',
    categorySlug: 'home-living',
    basePrice: 52,
    imageBackground: '#451a03',
    imageAccent: '#fdba74',
  },
  {
    name: 'Insulated Trail Bottle',
    slug: 'insulated-trail-bottle',
    categorySlug: 'sports-outdoors',
    basePrice: 39,
    imageBackground: '#064e3b',
    imageAccent: '#34d399',
  },
  {
    name: 'Adjustable Training Bands',
    slug: 'adjustable-training-bands',
    categorySlug: 'sports-outdoors',
    basePrice: 45,
    imageBackground: '#3f0d12',
    imageAccent: '#f97316',
  },
  {
    name: 'Compact Yoga Mat',
    slug: 'compact-yoga-mat',
    categorySlug: 'sports-outdoors',
    basePrice: 62,
    imageBackground: '#134e4a',
    imageAccent: '#5eead4',
  },
  {
    name: 'Vitamin C Face Serum',
    slug: 'vitamin-c-face-serum',
    categorySlug: 'beauty-personal-care',
    basePrice: 34,
    imageBackground: '#4a2408',
    imageAccent: '#fbbf24',
  },
  {
    name: 'Botanical Hand Care Set',
    slug: 'botanical-hand-care-set',
    categorySlug: 'beauty-personal-care',
    basePrice: 42,
    imageBackground: '#14532d',
    imageAccent: '#86efac',
  },
  {
    name: 'Mineral Sunscreen SPF 50',
    slug: 'mineral-sunscreen-spf-50',
    categorySlug: 'beauty-personal-care',
    basePrice: 28,
    imageBackground: '#164e63',
    imageAccent: '#67e8f9',
  },
  {
    name: 'Minimalist Travel Backpack',
    slug: 'minimalist-travel-backpack',
    categorySlug: 'accessories',
    basePrice: 118,
    imageBackground: '#1c1917',
    imageAccent: '#a8a29e',
  },
  {
    name: 'Polarized Everyday Sunglasses',
    slug: 'polarized-everyday-sunglasses',
    categorySlug: 'accessories',
    basePrice: 79,
    imageBackground: '#18181b',
    imageAccent: '#c084fc',
  },
  {
    name: 'Leather Card Wallet',
    slug: 'leather-card-wallet',
    categorySlug: 'accessories',
    basePrice: 49,
    imageBackground: '#451a03',
    imageAccent: '#d97706',
  },
  {
    name: 'Mechanical Gaming Keyboard',
    slug: 'mechanical-gaming-keyboard',
    categorySlug: 'gaming',
    basePrice: 139,
    imageBackground: '#2e1065',
    imageAccent: '#a78bfa',
  },
  {
    name: 'Wireless Precision Controller',
    slug: 'wireless-precision-controller',
    categorySlug: 'gaming',
    basePrice: 84,
    imageBackground: '#172554',
    imageAccent: '#60a5fa',
  },
];

const seedFrom = (value: string): number => {
  let hash = 2166136261;
  for (const character of value) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

const identityFaker = new Faker({ locale: [en] });

const titleCase = (value: string): string =>
  value
    .split(/[-\s]+/)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(' ');

export const createDemoTenantIdentity = (): DemoTenantIdentity => {
  const name = `${titleCase(identityFaker.word.adjective())} ${titleCase(identityFaker.word.noun())} Market`;
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50)
    .replace(/-$/, '');

  if (!slug) throw new Error('Unable to generate a demo tenant identity');
  return { name, slug };
};

const customerEmail = (tenantSlug: string, index: number): string =>
  `customer.${String(index + 1).padStart(2, '0')}.${tenantSlug.replace(/_/g, '.')}@example.com`;

export const buildDemoSeedData = (tenantSlug: string): DemoSeedData => {
  const faker = new Faker({ locale: [en] });
  faker.seed(seedFrom(tenantSlug));

  const categories = DEMO_CATEGORY_TEMPLATES.map((category) => ({
    ...category,
    description: `Explore ${category.name.toLowerCase()} selected for modern storefronts. ${faker.commerce.productDescription()}`,
    isActive: true,
  }));

  const products = DEMO_PRODUCT_TEMPLATES.map((product, index) => ({
    name: product.name,
    sku: `DEMO-${String(index + 1).padStart(3, '0')}`,
    slug: product.slug,
    description: `${faker.commerce.productAdjective()} ${product.name.toLowerCase()} for everyday use. ${faker.commerce.productDescription()}`,
    price:
      faker.number.int({
        min: Math.round(product.basePrice * 90),
        max: Math.round(product.basePrice * 110),
      }) / 100,
    stock: faker.number.int({ min: 8, max: 80 }),
    isActive: true,
    categorySlug: product.categorySlug,
    imageBackground: product.imageBackground,
    imageAccent: product.imageAccent,
  }));

  const customers = Array.from({ length: DEMO_CUSTOMER_COUNT }, (_, index) => {
    const firstName = faker.person.firstName();
    const lastName = faker.person.lastName();
    return {
      name: `${firstName} ${lastName}`,
      email: customerEmail(tenantSlug, index),
      phone: `+1 555 ${faker.string.numeric(3)} ${faker.string.numeric(4)}`,
      line1: faker.location.streetAddress(),
      line2: index % 3 === 0 ? faker.location.secondaryAddress() : null,
      city: faker.location.city(),
      state: faker.location.state({ abbreviated: true }),
      postalCode: faker.location.zipCode(),
      country: 'US',
    };
  });

  return { customers, categories, products };
};
