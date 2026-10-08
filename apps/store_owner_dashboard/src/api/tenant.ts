const IPV4_PATTERN = /^\d{1,3}(\.\d{1,3}){3}$/;
const LABEL_REGEX = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;
const MAX_LABEL_LENGTH = 63;
const DEV_ROOT_DOMAIN = "localhost";

export const TENANT_SLUG_KEY = "tenant-slug";

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
 * The JWT carries the tenant *schema* name (`tenant_<slug>`), while the host or
 * `?tenant=` carries the bare slug, so the schema prefix is stripped before
 * comparing. This is a UX guard only: the backend MUST derive and enforce the
 * tenant from the authenticated principal. Skipped when the slug cannot be
 * derived (dev).
 */
export const tenantMatchesSlug = (
  jwtTenant: string | null | undefined,
  slug: string | null,
): boolean => {
  if (!slug || !jwtTenant) return true;
  const schemaLabel = normalizeTenant(jwtTenant).replace(/^tenant/, "");
  return schemaLabel === normalizeTenant(slug);
};

export const allowSubdomain = (): boolean =>
  import.meta.env.VITE_ALLOW_SUBDOMAIN !== "false";

const stripHostPort = (host: string | null | undefined): string =>
  (host ?? "").trim().toLowerCase().split(":")[0];

const normalizeRootDomain = (
  root: string | null | undefined,
): string | null => {
  if (!root) return null;
  const normalized = stripHostPort(root)
    .replace(/^\.+/, "")
    .replace(/\.+$/, "");
  return normalized || null;
};

export const getAppRootDomain = (): string =>
  normalizeRootDomain(import.meta.env.VITE_APP_ROOT_DOMAIN) ?? DEV_ROOT_DOMAIN;

export const isValidTenantSlug = (candidate: string): boolean =>
  candidate.length > 0 &&
  candidate.length <= MAX_LABEL_LENGTH &&
  LABEL_REGEX.test(candidate);

export const getTenantSlugFromHost = (
  hostname: string | null | undefined,
  rootDomain: string | null | undefined = getAppRootDomain(),
): string | null => {
  const host = stripHostPort(hostname);
  const root = normalizeRootDomain(rootDomain);
  if (!host || !root) return null;

  if (host === root || host === `www.${root}`) return null;

  if (host.endsWith(`.${root}`)) {
    const candidate = host.slice(0, -(root.length + 1));
    if (isValidTenantSlug(candidate)) return candidate;
  }

  return null;
};

export const getTenantSlugFromParam = (
  searchParams: URLSearchParams | null | undefined,
): string | null => {
  const candidate = searchParams?.get("tenant") ?? null;
  return candidate && isValidTenantSlug(candidate) ? candidate : null;
};

const getPersistedTenantSlug = (): string | null => {
  if (typeof window === "undefined") return null;
  const stored = window.sessionStorage.getItem(TENANT_SLUG_KEY);
  return stored && isValidTenantSlug(stored) ? stored : null;
};

const persistTenantSlug = (slug: string): void => {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(TENANT_SLUG_KEY, slug);
};

export type TenantResolutionInput = {
  hostname: string;
  search: string;
  persistedSlug?: string | null;
};

export const resolveTenantSlugFrom = ({
  hostname,
  search,
  persistedSlug,
}: TenantResolutionInput): string | null => {
  if (allowSubdomain()) return hostname.split(".")[0] || null;

  const hostSlug = getTenantSlugFromHost(hostname);
  if (hostSlug) return hostSlug;

  const paramSlug = getTenantSlugFromParam(new URLSearchParams(search));
  if (paramSlug) return paramSlug;

  return persistedSlug ?? null;
};

export const getCurrentTenantSlug = (): string | null => {
  if (typeof window === "undefined") return null;

  const resolved = resolveTenantSlugFrom({
    hostname: window.location.hostname,
    search: window.location.search,
    persistedSlug: getPersistedTenantSlug(),
  });

  if (!allowSubdomain() && resolved) persistTenantSlug(resolved);

  return resolved;
};

export const getTenantHeaderSlug = (): string | null => {
  if (typeof window === "undefined") return null;
  if (allowSubdomain()) return window.location.hostname.split(".")[0] || null;
  return getCurrentTenantSlug();
};

export const getGuardTenantSlug = (): string | null =>
  allowSubdomain() ? getTenantSlug() : getCurrentTenantSlug();

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

export const ensureTenantParamInUrl = (): void => {
  if (typeof window === "undefined") return;
  if (allowSubdomain()) return;

  const slug = getCurrentTenantSlug();
  if (!slug) return;

  const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  const next = withTenantParam(current, slug);
  if (next !== current) window.history.replaceState(null, "", next);
};
