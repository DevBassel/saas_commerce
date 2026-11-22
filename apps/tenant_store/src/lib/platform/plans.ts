import type {
  IPlanFeature,
  IPlanLimit,
  ISubscriptionPlan,
} from "@/api/plansApi";

/**
 * Display helpers for public platform pricing. The plan data itself is fetched
 * from `GET /platform/subscription-plans` (see `src/api/plansApi.ts`); this
 * module only turns raw limits, features, and prices into display values.
 */

const LIMIT_LABELS: Record<string, string> = {
  PRODUCTS: "products",
  STORAGE_BYTES: "storage",
  DATABASE_BYTES: "database",
  STORE_ADMINS: "admins",
  COUPONS_PER_MONTH: "coupons / month",
};

const FEATURE_LABELS: Record<string, string> = {
  STRIPE_PAYMENTS: "Stripe payments",
  STORE_CUSTOMIZATION: "Store customization",
  COUPONS: "Coupons",
  STAFF_MANAGEMENT: "Staff management",
  PRODUCT_IMPORT_EXPORT: "Product import / export",
  CUSTOM_DOMAIN: "Custom domain",
  ADVANCED_ANALYTICS: "Advanced analytics",
  ADVANCED_REPORTS: "Advanced reports",
  SEO_TOOLS: "SEO tools",
  AUDIT_LOGS: "Audit logs",
  PRIORITY_SUPPORT: "Priority support",
};

function humanizeKey(key: string): string {
  return key
    .toLowerCase()
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

/** Formats a byte count as MB/GB/TB, or "Unlimited" for a null limit. */
export function formatBytes(value: number | null): string {
  if (value == null) return "Unlimited";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let amount = value;
  let unit = 0;
  while (amount >= 1024 && unit < units.length - 1) {
    amount /= 1024;
    unit += 1;
  }
  const rounded = Number.isInteger(amount) ? amount : Number(amount.toFixed(1));
  return `${rounded} ${units[unit]}`;
}

/** Human label for a single plan limit, e.g. "10 products" or "500 MB storage". */
export function formatLimit(limit: IPlanLimit): string {
  const label = LIMIT_LABELS[limit.key] ?? humanizeKey(limit.key).toLowerCase();
  if (limit.value == null) return `Unlimited ${label}`;
  const value =
    limit.type === "BYTES" ? formatBytes(limit.value) : String(limit.value);
  return `${value} ${label}`;
}

export function formatFeature(feature: IPlanFeature): {
  label: string;
  enabled: boolean;
} {
  return {
    label: FEATURE_LABELS[feature.key] ?? humanizeKey(feature.key),
    enabled: feature.enabled,
  };
}

export function isFreePlan(plan: ISubscriptionPlan): boolean {
  return plan.monthlyPrice <= 0 && plan.yearlyPrice <= 0;
}

function formatPrice(amount: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: (currency || "usd").toUpperCase(),
    maximumFractionDigits: 2,
  }).format(amount);
}

/** Every configured paid billing option, or a single free option. */
export function planPrices(plan: ISubscriptionPlan): Array<{
  interval: "free" | "monthly" | "yearly";
  amount: string;
  cadence: string;
}> {
  const prices: Array<{
    interval: "monthly" | "yearly";
    amount: string;
    cadence: string;
  }> = [];

  if (plan.monthlyPrice > 0) {
    prices.push({
      interval: "monthly",
      amount: formatPrice(plan.monthlyPrice, plan.currency),
      cadence: "per month",
    });
  }
  if (plan.yearlyPrice > 0) {
    prices.push({
      interval: "yearly",
      amount: formatPrice(plan.yearlyPrice, plan.currency),
      cadence: "per year",
    });
  }

  return prices.length > 0
    ? prices
    : [{ interval: "free", amount: "Free", cadence: "to get started" }];
}
