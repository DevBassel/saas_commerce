import { formatBytes } from "@/lib/utils";
import type {
  BillingInterval,
  LimitValueType,
  SubscriptionFeatureKey,
  SubscriptionLimitKey,
  SubscriptionPlan,
  SubscriptionStatus,
} from "@/types/subscription";

export const LIMIT_KEYS: SubscriptionLimitKey[] = [
  "STORAGE_BYTES",
  "DATABASE_BYTES",
  "STORE_ADMINS",
  "COUPONS_PER_MONTH",
  "PRODUCTS",
];

export const LIMIT_TYPE_BY_KEY: Record<
  SubscriptionLimitKey,
  LimitValueType
> = {
  STORAGE_BYTES: "BYTES",
  DATABASE_BYTES: "BYTES",
  STORE_ADMINS: "COUNT",
  COUPONS_PER_MONTH: "COUNT",
  PRODUCTS: "COUNT",
};

export const LIMIT_LABELS: Record<SubscriptionLimitKey, string> = {
  STORAGE_BYTES: "Storage",
  DATABASE_BYTES: "Database",
  STORE_ADMINS: "Store admins",
  COUPONS_PER_MONTH: "Coupons per month",
  PRODUCTS: "Products",
};

export const FEATURE_LABELS: Record<SubscriptionFeatureKey, string> = {
  STRIPE_PAYMENTS: "Stripe payments",
  STORE_CUSTOMIZATION: "Store customization",
  COUPONS: "Coupons",
  STAFF_MANAGEMENT: "Staff management",
  PRODUCT_IMPORT_EXPORT: "Product import/export",
  CUSTOM_DOMAIN: "Custom domain",
  ADVANCED_ANALYTICS: "Advanced analytics",
  ADVANCED_REPORTS: "Advanced reports",
  SEO_TOOLS: "SEO tools",
  AUDIT_LOGS: "Audit logs",
  PRIORITY_SUPPORT: "Priority support",
};

export const STATUS_LABELS: Record<SubscriptionStatus, string> = {
  TRIALING: "Trialing",
  ACTIVE: "Active",
  PAST_DUE: "Past due",
  CANCELED: "Canceled",
  UNPAID: "Unpaid",
  INCOMPLETE: "Incomplete",
  INCOMPLETE_EXPIRED: "Incomplete expired",
  PAUSED: "Paused",
};

export const BILLING_INTERVAL_LABELS: Record<BillingInterval, string> = {
  MONTHLY: "Monthly",
  YEARLY: "Yearly",
};

export const formatLimitValue = (
  value: number | null,
  type: LimitValueType,
): string => {
  if (value == null) return "Unlimited";
  if (type === "BYTES") return formatBytes(value);
  return value.toLocaleString();
};

export const priceFor = (
  plan: SubscriptionPlan,
  interval: BillingInterval,
): number => (interval === "YEARLY" ? plan.yearlyPrice : plan.monthlyPrice);

export const intervalWord = (interval: BillingInterval): string =>
  interval === "YEARLY" ? "year" : "month";
