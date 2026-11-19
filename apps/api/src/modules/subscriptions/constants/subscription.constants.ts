/**
 * Effective byte capacity mirrored into `Tenant.storageCapacityBytes` for a plan
 * without a `STORAGE_BYTES` limit row (unlimited). It is large enough to never
 * be reached in practice but still a safe integer for the bigint column and the
 * `BigInt(...)` comparisons in `TenantService.adjustStorageUsedBytes`.
 */
export const UNLIMITED_STORAGE_BYTES = BigInt(Number.MAX_SAFE_INTEGER);

export const FREE_PLAN_SLUG = 'free';

/**
 * Self-serve cancel + refund window, measured from the latest PAID
 * `SubscriptionPayment` (`paidAt`, falling back to `createdAt`). Kept in ms so
 * the service and the `GET /subscription` eligibility read compute the same
 * deadline. Not an env var by design.
 */
export const SUBSCRIPTION_REFUND_WINDOW_DAYS = 7;

/** Frequency for reconciling elapsed trial and billing periods. */
export const SUBSCRIPTION_LIFECYCLE_INTERVAL_MS = 5 * 60 * 1000;

export const SUBSCRIPTION_SORTABLE_FIELDS = [
  'name',
  'slug',
  'monthlyPrice',
  'yearlyPrice',
  'sortOrder',
  'trialDays',
  'active',
  'isPublic',
  'createdAt',
  'updatedAt',
] as const;
