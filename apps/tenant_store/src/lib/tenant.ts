import { headers } from "next/headers";

export interface StoreInfo {
  name: string;
  slug: string;
  currency: string;
}

export const getTenantSlugFromHost = (host: string | null): string | null => {
  if (!host) return null;
  const hostname = host.split(":")[0];
  return hostname.split(".")[0] || null;
};

/**
 * Server-side store metadata lookup. The backend resolves the tenant from the
 * `x-tenant-slug` header, so the storefront only needs to forward the host's
 * subdomain. Results are cached for 60s to match the catalog ISR window.
 */
export async function getStoreInfo(): Promise<StoreInfo | null> {
  const host = (await headers()).get("host");
  const slug = getTenantSlugFromHost(host);
  const baseUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
  if (!slug || !baseUrl) return null;

  try {
    const response = await fetch(`${baseUrl}/store/info`, {
      headers: { "x-tenant-slug": slug },
      next: { revalidate: 60 },
    });
    if (!response.ok) return null;
    return (await response.json()) as StoreInfo;
  } catch {
    return null;
  }
}
