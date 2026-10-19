import { ICache } from '../config/env.interface';

export type CacheScope = 'tenant' | 'platform';

export type CachePolicyName = 'products' | 'categories' | 'plans';

export interface CachePolicyDefinition {
  name: CachePolicyName;
  scope: CacheScope;
  namespace: string;
}

export const CACHE_POLICIES: Record<CachePolicyName, CachePolicyDefinition> = {
  products: { name: 'products', scope: 'tenant', namespace: 'products' },
  categories: { name: 'categories', scope: 'tenant', namespace: 'categories' },
  plans: {
    name: 'plans',
    scope: 'platform',
    namespace: 'subscription-plans',
  },
};

/**
 * The complete cache allowlist. Any `@CacheResponse` outside this set is
 * ignored with a configuration warning.
 */
export const CACHEABLE_ROUTES = new Set<string>([
  'GET /products',
  'GET /products/:id',
  'GET /categories',
  'GET /categories/:id',
  'GET /subscription/plans',
  'GET /platform/subscription-plans',
]);

export const resolveCacheTtlMs = (
  policy: CachePolicyName,
  cache: ICache,
): number => {
  const seconds =
    policy === 'products'
      ? cache.productsTtlSeconds
      : policy === 'categories'
        ? cache.categoriesTtlSeconds
        : cache.plansTtlSeconds;
  return Math.max(1, seconds) * 1000;
};
