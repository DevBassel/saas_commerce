/**
 * Tenant-aware URL helpers.
 *
 * Pure and safe to import from Server Components, the edge proxy and the
 * browser. The client-only counterparts (`useTenantParam`, `useTenantRouter`,
 * `TenantLink`) live in `./nav` so this module never pulls React hooks into a
 * Server Component.
 */

import {
  allowSubdomain,
  getTenantSlugFromHost,
  getTenantSlugFromParam,
} from "./host";

/**
 * Appends `tenant=<slug>` to a path or URL, preserving any existing query and
 * hash. An existing `tenant` parameter is replaced so repeated calls stay
 * idempotent (e.g. a callbackUrl that already carries the tenant). Returns the
 * input unchanged when there is no slug.
 */
export const withTenantParam = (
  path: string,
  slug: string | null | undefined,
): string => {
  if (!slug) return path;

  const hashIndex = path.indexOf("#");
  const hash = hashIndex >= 0 ? path.slice(hashIndex) : "";
  const withoutHash = hashIndex >= 0 ? path.slice(0, hashIndex) : path;

  const queryIndex = withoutHash.indexOf("?");
  const pathname =
    queryIndex >= 0 ? withoutHash.slice(0, queryIndex) : withoutHash;
  const query = queryIndex >= 0 ? withoutHash.slice(queryIndex + 1) : "";

  const params = new URLSearchParams(query);
  params.set("tenant", slug);

  return `${pathname}?${params.toString()}${hash}`;
};

/**
 * Tenant slug for browser-originated code (the axios client, logout, the
 * verification redirect): the host label wins, and when subdomain mode is off
 * the `?tenant=` parameter is the fallback. Safe on the server (returns `null`)
 * so isomorphic modules can call it unconditionally.
 */
export const getBrowserTenantSlug = (): string | null => {
  if (typeof window === "undefined") return null;
  const hostSlug = getTenantSlugFromHost(window.location.hostname);
  if (hostSlug) return hostSlug;
  if (!allowSubdomain()) {
    return getTenantSlugFromParam(new URLSearchParams(window.location.search));
  }
  return null;
};
