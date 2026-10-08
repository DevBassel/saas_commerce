import { headers } from "next/headers";
import { allowSubdomain, getTenantSlugFromHost } from "./host";

export { getTenantSlugFromHost } from "./host";

export interface StoreInfo {
  name: string;
  slug: string;
  currency: string;
}

export type LoadStoreInfoResult =
  | { status: "ok"; store: StoreInfo }
  | { status: "not-found" }
  | { status: "unavailable" };

/**
 * Tenant-scoped cache tag for storefront-owned revalidation.
 * Invalidate a tenant's cached store info with `revalidateTag(storeTag(slug))`.
 */
export const storeTag = (slug: string) => `store:${slug}`;

/**
 * Server-side store metadata lookup.
 *
 * IMPORTANT — tenant is part of the cache key. Next.js Data Cache keys on the
 * request URL + fetch options only; the `x-tenant-slug` request header is NOT
 * part of that key. We therefore repeat the tenant in the query string (the
 * backend resolves the tenant from the header and ignores the extra param) so
 * two tenants can never collide on `<backend>/store/info`. The `tags` are added
 * so the entry can be invalidated per tenant; they do not partition the cache.
 *
 * Never cache a backend response whose tenant is expressed only by a header
 * unless the tenant is also in the URL/tag key.
 */
export async function loadStoreInfo(): Promise<LoadStoreInfoResult> {
  const requestHeaders = await headers();
  // The proxy sets a trusted `x-tenant-slug` for tenant contexts (host subdomain
  // or, when subdomain mode is off, the `?tenant=` parameter). Fall back to the
  // raw host so the module still works if it is rendered without the proxy.
  const slug =
    requestHeaders.get("x-tenant-slug") ??
    getTenantSlugFromHost(requestHeaders.get("host"));
  const baseUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
  if (!slug) return { status: "not-found" };
  if (!baseUrl) return { status: "unavailable" };

  try {
    const response = await fetch(
      `${baseUrl}/store/info?tenant=${encodeURIComponent(slug)}`,
      {
        headers: { "x-tenant-slug": slug },
        next: { revalidate: 60, tags: ["store", storeTag(slug)] },
      },
    );
    if (response.status === 404) return { status: "not-found" };
    if (!response.ok) return { status: "unavailable" };
    return { status: "ok", store: (await response.json()) as StoreInfo };
  } catch {
    return { status: "unavailable" };
  }
}

/** Store metadata for the current host, or `null` when it cannot be resolved. */
export async function getStoreInfo(): Promise<StoreInfo | null> {
  const result = await loadStoreInfo();
  return result.status === "ok" ? result.store : null;
}

/**
 * Tenant slug that storefront URLs must carry, or `null` when it should not be
 * added (subdomain mode) or the request is the platform context.
 *
 * Read from the trusted `x-tenant-slug` header the proxy sets, falling back to
 * the host label. Server Components use this together with `withTenantParam`.
 */
export async function getTenantParam(): Promise<string | null> {
  if (allowSubdomain()) return null;
  const requestHeaders = await headers();
  return (
    requestHeaders.get("x-tenant-slug") ??
    getTenantSlugFromHost(requestHeaders.get("host"))
  );
}
