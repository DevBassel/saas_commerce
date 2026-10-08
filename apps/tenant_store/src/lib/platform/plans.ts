import type { IPlanLimit, ISubscriptionPlan } from "@/api/plansApi";

/**
 * Display helpers for the public `/plans` page. The plan data itself is fetched
 * from `GET /platform/subscription-plans` (see `src/api/plansApi.ts`); this
 * module only turns raw limits/features into human-readable strings.
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
  const label = LIMIT_LABELS[limit.key] ?? limit.key.toLowerCase();
  if (limit.value == null) return `Unlimited ${label}`;
  const value =
    limit.type === "BYTES" ? formatBytes(limit.value) : String(limit.value);
  return `${value} ${label}`;
}

/** Enabled feature labels for a plan. */
export function planFeatureLabels(plan: ISubscriptionPlan): string[] {
  return (plan.features ?? [])
    .filter((feature) => feature.enabled)
    .map((feature) => FEATURE_LABELS[feature.key] ?? feature.key);
}

/** A short price line; the API seeds price 0, so fall back to Free/Custom. */
export function planPrice(plan: ISubscriptionPlan): {
  amount: string;
  cadence: string;
} {
  if (plan.monthlyPrice > 0) {
    const amount = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: (plan.currency || "usd").toUpperCase(),
      maximumFractionDigits: 0,
    }).format(plan.monthlyPrice);
    return { amount, cadence: "per month" };
  }
  if (plan.slug === "enterprise") return { amount: "Custom", cadence: "talk to us" };
  return { amount: "Free", cadence: "forever" };
}
