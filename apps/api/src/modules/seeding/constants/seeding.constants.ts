export const PLATFORM_SEEDERS = 'PLATFORM_SEEDERS';
export const TENANT_SEEDERS = 'TENANT_SEEDERS';

/** Deterministic execution order; ties break by seeder name. */
export const SeederOrder = {
  PERMISSIONS: 10,
  ROLES: 20,
  SUPER_ADMIN: 30,
  SUBSCRIPTION_PLANS: 40,
  SUBSCRIPTION_BACKFILL: 50,
  CATEGORIES: 50,
} as const;

export enum SeederScope {
  PLATFORM = 'platform',
  TENANT = 'tenant',
}
