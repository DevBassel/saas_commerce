export type SubscriptionLimitKey =
  | "STORAGE_BYTES"
  | "DATABASE_BYTES"
  | "STORE_ADMINS"
  | "COUPONS_PER_MONTH"
  | "PRODUCTS";

export type SubscriptionFeatureKey =
  | "STRIPE_PAYMENTS"
  | "STORE_CUSTOMIZATION"
  | "COUPONS"
  | "STAFF_MANAGEMENT"
  | "PRODUCT_IMPORT_EXPORT"
  | "CUSTOM_DOMAIN"
  | "ADVANCED_ANALYTICS"
  | "ADVANCED_REPORTS"
  | "SEO_TOOLS"
  | "AUDIT_LOGS"
  | "PRIORITY_SUPPORT";

export type SubscriptionStatus =
  | "TRIALING"
  | "ACTIVE"
  | "PAST_DUE"
  | "CANCELED"
  | "UNPAID"
  | "INCOMPLETE"
  | "INCOMPLETE_EXPIRED"
  | "PAUSED";

export type BillingInterval = "MONTHLY" | "YEARLY";

export type LimitValueType = "BYTES" | "COUNT";

export type SubscriptionPlanLimit = {
  id: number;
  planId: number;
  key: SubscriptionLimitKey;
  value: number | null;
  type: LimitValueType;
};

export type SubscriptionPlanFeature = {
  id: number;
  planId: number;
  key: SubscriptionFeatureKey;
  enabled: boolean;
};

export type SubscriptionPlan = {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  monthlyPrice: number;
  yearlyPrice: number;
  currency: string;
  active: boolean;
  isPublic: boolean;
  sortOrder: number;
  trialDays: number;
  createdAt: string;
  updatedAt: string;
  limits: SubscriptionPlanLimit[];
  features: SubscriptionPlanFeature[];
};

export type Subscription = {
  id: number;
  tenantId: number;
  planId: number;
  status: SubscriptionStatus;
  billingInterval: BillingInterval;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  canceledAt: string | null;
  trialStart: string | null;
  trialEnd: string | null;
  plan?: SubscriptionPlan;
};

export type TenantSubscriptionResponse = {
  plan: SubscriptionPlan | null;
  subscription: Subscription | null;
};

export type UsageValue = {
  used: number;
  limit: number | null;
  remaining: number | null;
};

export type UsageSummary = Record<SubscriptionLimitKey, UsageValue>;

export type SubscriptionPlanPayload = {
  name: string;
  slug: string;
  description?: string | null;
  monthlyPrice?: number;
  yearlyPrice?: number;
  currency?: string;
  active?: boolean;
  isPublic?: boolean;
  sortOrder?: number;
  trialDays?: number;
  limits: {
    key: SubscriptionLimitKey;
    value: number | null;
    type: LimitValueType;
  }[];
  features: {
    key: SubscriptionFeatureKey;
    enabled: boolean;
  }[];
};

export type AssignSubscriptionPayload = {
  planId: number;
  billingInterval?: BillingInterval;
};
