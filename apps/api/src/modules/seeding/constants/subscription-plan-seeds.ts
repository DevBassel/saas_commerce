import { SubscriptionLimitKey } from 'src/modules/subscriptions/constants/subscription-limit-key.enum';
import { SubscriptionFeatureKey } from 'src/modules/subscriptions/constants/subscription-feature-key.enum';
import { LimitValueType } from 'src/modules/subscriptions/constants/limit-value-type.enum';

export interface PlanLimitSeed {
  key: SubscriptionLimitKey;
  value: number | null;
  type: LimitValueType;
}

export interface PlanFeatureSeed {
  key: SubscriptionFeatureKey;
  enabled: boolean;
}

export interface PlanSeed {
  slug: string;
  name: string;
  description: string;
  monthlyPrice: number;
  yearlyPrice: number;
  currency: string;
  sortOrder: number;
  limits: PlanLimitSeed[];
  features: PlanFeatureSeed[];
}

const MB = 1024 * 1024;
const GB = 1024 * MB;

const BYTES = LimitValueType.BYTES;
const COUNT = LimitValueType.COUNT;

const F = SubscriptionFeatureKey;

const FREE_FEATURES: SubscriptionFeatureKey[] = [F.STRIPE_PAYMENTS, F.COUPONS];

const STARTER_FEATURES: SubscriptionFeatureKey[] = [
  ...FREE_FEATURES,
  F.STAFF_MANAGEMENT,
  F.PRODUCT_IMPORT_EXPORT,
];

const GROWTH_FEATURES: SubscriptionFeatureKey[] = [
  ...STARTER_FEATURES,
  F.CUSTOM_DOMAIN,
  F.ADVANCED_ANALYTICS,
  F.ADVANCED_REPORTS,
  F.SEO_TOOLS,
];

const PRO_FEATURES: SubscriptionFeatureKey[] = [
  ...GROWTH_FEATURES,
  F.AUDIT_LOGS,
  F.PRIORITY_SUPPORT,
];

const ALL_FEATURES: SubscriptionFeatureKey[] = Object.values(F);

const features = (keys: SubscriptionFeatureKey[]): PlanFeatureSeed[] =>
  keys.map((key) => ({ key, enabled: true }));

export const PLAN_SEEDS: PlanSeed[] = [
  {
    slug: 'free',
    name: 'Free',
    description: 'Entry plan for new stores',
    monthlyPrice: 0,
    yearlyPrice: 0,
    currency: 'usd',
    sortOrder: 0,
    limits: [
      { key: SubscriptionLimitKey.STORAGE_BYTES, value: 500 * MB, type: BYTES },
      {
        key: SubscriptionLimitKey.DATABASE_BYTES,
        value: 50 * MB,
        type: BYTES,
      },
      { key: SubscriptionLimitKey.STORE_ADMINS, value: 1, type: COUNT },
      {
        key: SubscriptionLimitKey.COUPONS_PER_MONTH,
        value: 5,
        type: COUNT,
      },
      { key: SubscriptionLimitKey.PRODUCTS, value: 10, type: COUNT },
    ],
    features: features(FREE_FEATURES),
  },
  {
    slug: 'starter',
    name: 'Starter',
    description: 'For growing stores',
    monthlyPrice: 29,
    yearlyPrice: 290,
    currency: 'usd',
    sortOrder: 1,
    limits: [
      { key: SubscriptionLimitKey.STORAGE_BYTES, value: 10 * GB, type: BYTES },
      {
        key: SubscriptionLimitKey.DATABASE_BYTES,
        value: 500 * MB,
        type: BYTES,
      },
      { key: SubscriptionLimitKey.STORE_ADMINS, value: 2, type: COUNT },
      {
        key: SubscriptionLimitKey.COUPONS_PER_MONTH,
        value: 25,
        type: COUNT,
      },
      { key: SubscriptionLimitKey.PRODUCTS, value: 100, type: COUNT },
    ],
    features: features(STARTER_FEATURES),
  },
  {
    slug: 'growth',
    name: 'Growth',
    description: 'More capacity and analytics',
    monthlyPrice: 99,
    yearlyPrice: 990,
    currency: 'usd',
    sortOrder: 2,
    limits: [
      { key: SubscriptionLimitKey.STORAGE_BYTES, value: 50 * GB, type: BYTES },
      {
        key: SubscriptionLimitKey.DATABASE_BYTES,
        value: 2 * GB,
        type: BYTES,
      },
      { key: SubscriptionLimitKey.STORE_ADMINS, value: 5, type: COUNT },
      {
        key: SubscriptionLimitKey.COUPONS_PER_MONTH,
        value: 100,
        type: COUNT,
      },
      { key: SubscriptionLimitKey.PRODUCTS, value: 1000, type: COUNT },
    ],
    features: features(GROWTH_FEATURES),
  },
  {
    slug: 'pro',
    name: 'Pro',
    description: 'High volume stores',
    monthlyPrice: 299,
    yearlyPrice: 2990,
    currency: 'usd',
    sortOrder: 3,
    limits: [
      { key: SubscriptionLimitKey.STORAGE_BYTES, value: 200 * GB, type: BYTES },
      {
        key: SubscriptionLimitKey.DATABASE_BYTES,
        value: 10 * GB,
        type: BYTES,
      },
      { key: SubscriptionLimitKey.STORE_ADMINS, value: 15, type: COUNT },
      {
        key: SubscriptionLimitKey.COUPONS_PER_MONTH,
        value: 500,
        type: COUNT,
      },
      { key: SubscriptionLimitKey.PRODUCTS, value: 5000, type: COUNT },
    ],
    features: features(PRO_FEATURES),
  },
  {
    slug: 'enterprise',
    name: 'Enterprise',
    description: 'Unlimited usage and every feature',
    monthlyPrice: 999,
    yearlyPrice: 9990,
    currency: 'usd',
    sortOrder: 4,
    limits: [],
    features: features(ALL_FEATURES),
  },
];
