const IPV4_PATTERN = /^\d{1,3}(\.\d{1,3}){3}$/;

/**
 * Resolves the tenant slug from the current hostname.
 *
 * Returns `null` for bare hosts (localhost, apex domains, or IP addresses)
 * where a tenant cannot be inferred from the URL.
 */
export const getTenantSlug = (): string | null => {
  if (typeof window === "undefined") return null;

  const hostname = window.location.hostname;
  if (!hostname || hostname === "localhost" || IPV4_PATTERN.test(hostname)) {
    return null;
  }

  const labels = hostname.split(".");
  if (labels.length < 3) return null;

  return labels[0] || null;
};

export const normalizeTenant = (value: string | null | undefined): string =>
  (value ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");

/**
 * Best-effort client-side check that the session's tenant matches the host.
 *
 * This is a UX guard only: the backend MUST derive and enforce the tenant from
 * the authenticated principal. Skipped when the slug cannot be derived (dev).
 */
export const tenantMatchesSlug = (
  jwtTenant: string | null | undefined,
  slug: string | null,
): boolean => {
  if (!slug || !jwtTenant) return true;
  return normalizeTenant(jwtTenant) === normalizeTenant(slug);
};
