/**
 * Effective byte capacity mirrored into `Tenant.storageCapacityBytes` for a plan
 * without a `STORAGE_BYTES` limit row (unlimited). It is large enough to never
 * be reached in practice but still a safe integer for the bigint column and the
 * `BigInt(...)` comparisons in `TenantService.adjustStorageUsedBytes`.
 */
export const UNLIMITED_STORAGE_BYTES = BigInt(Number.MAX_SAFE_INTEGER);

export const FREE_PLAN_SLUG = 'free';

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
