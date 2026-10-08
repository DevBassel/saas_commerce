/**
 * Host classification: the single source of truth for which context a request
 * belongs to.
 *
 * The storefront serves two contexts from one deployment, decided by hostname:
 *
 * - **platform** — the apex root domain (`example.com`, `www.example.com`) and
 *   its local dev equivalent (`localhost`). No tenant is resolved.
 * - **tenant** — a single-label subdomain of the root (`nike.example.com`). The
 *   label is the tenant slug.
 * - **invalid** — anything else (a host that does not belong to the root
 *   domain, a lookalike such as `nike.example.com.evil.com`, or an empty host).
 *
 * Root-domain awareness is why this module exists: `getTenantSlugFromHost` used
 * to return the first host label unconditionally, which made the apex
 * (`example.com` -> `example`) collide with a real tenant whose subdomain is
 * `example` (`example.example.com`).
 *
 * It must stay free of `next/headers` and other server-only imports so it can be
 * used from the edge proxy, the isomorphic api client and Server Components
 * alike.
 */

/** Valid DNS label / tenant slug (mirrors the API's `SLUG_REGEX`). */
const LABEL_REGEX = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;
const MAX_LABEL_LENGTH = 63;

/** Dev fallback when `NEXT_PUBLIC_APP_ROOT_DOMAIN` is not set. */
const DEV_ROOT_DOMAIN = "localhost";

export type HostClassification =
  | { kind: "platform" }
  | { kind: "tenant"; slug: string }
  | { kind: "invalid" };

/** Lowercases a host and drops the port so `localhost:3000` and `localhost` agree. */
export const stripHostPort = (host: string | null | undefined): string =>
  (host ?? "").trim().toLowerCase().split(":")[0];

/**
 * Normalizes a configured root domain: lowercase, no scheme, no port, no
 * leading/trailing dot. Returns `null` when nothing usable remains.
 */
export const normalizeRootDomain = (
  root: string | null | undefined,
): string | null => {
  if (!root) return null;
  const normalized = stripHostPort(root)
    .replace(/^\.+/, "")
    .replace(/\.+$/, "");
  return normalized || null;
};

/**
 * The configured platform root domain.
 *
 * `NEXT_PUBLIC_APP_ROOT_DOMAIN` is inlined at build time, so it is readable from
 * the edge proxy, server components and the browser alike. It defaults to
 * `localhost` so local development and local builds work without the variable;
 * production builds must set it to the real apex (e.g. `example.com`).
 */
export const getAppRootDomain = (): string =>
  normalizeRootDomain(process.env.NEXT_PUBLIC_APP_ROOT_DOMAIN) ?? DEV_ROOT_DOMAIN;

/** True when `candidate` is a syntactically valid tenant slug. */
export const isValidTenantSlug = (candidate: string): boolean =>
  candidate.length > 0 &&
  candidate.length <= MAX_LABEL_LENGTH &&
  LABEL_REGEX.test(candidate);

/**
 * Classifies a request host against the root domain.
 *
 * A tenant host is exactly `<label>.<root>` (one label); deeper subdomains and
 * lookalike suffixes are rejected as invalid rather than guessed.
 */
export const classifyHost = (
  host: string | null | undefined,
  rootDomain: string | null | undefined = getAppRootDomain(),
): HostClassification => {
  const hostname = stripHostPort(host);
  const root = normalizeRootDomain(rootDomain);
  if (!hostname || !root) return { kind: "invalid" };

  if (hostname === root || hostname === `www.${root}`) {
    return { kind: "platform" };
  }

  if (hostname.endsWith(`.${root}`)) {
    const candidate = hostname.slice(0, -(root.length + 1));
    if (isValidTenantSlug(candidate)) return { kind: "tenant", slug: candidate };
  }

  return { kind: "invalid" };
};

/**
 * Tenant slug for the current host, or `null` for platform/invalid hosts.
 *
 * Kept as the stable entry point used by the api client and the server
 * store-info module; it now returns `null` on the platform apex so platform
 * requests never send `x-tenant-slug`.
 */
export const getTenantSlugFromHost = (
  host: string | null | undefined,
  rootDomain: string | null | undefined = getAppRootDomain(),
): string | null => {
  const classification = classifyHost(host, rootDomain);
  return classification.kind === "tenant" ? classification.slug : null;
};

/**
 * Whether host-based (subdomain) tenant resolution is enabled.
 *
 * `NEXT_PUBLIC_ALLOW_SUBDOMAIN` is inlined at build time and read in the edge
 * proxy, Server Components and the browser. Only the literal string `"false"`
 * turns subdomain mode off (enabling the `?tenant=<slug>` fallback); unset,
 * empty and `"true"` all keep today's subdomain behavior.
 */
export const allowSubdomain = (): boolean =>
  process.env.NEXT_PUBLIC_ALLOW_SUBDOMAIN !== "false";

/**
 * Tenant slug carried by the `?tenant=` query parameter, or `null` when the
 * parameter is absent or not a valid slug. Only a syntactically valid slug is
 * treated as tenant intent; anything else falls back to the platform context.
 */
export const getTenantSlugFromParam = (
  searchParams: URLSearchParams | null | undefined,
): string | null => {
  const candidate = searchParams?.get("tenant") ?? null;
  return candidate && isValidTenantSlug(candidate) ? candidate : null;
};

/**
 * The tenant for a request, combining both resolution modes.
 *
 * A tenant subdomain host always wins (in either mode). The `?tenant=` fallback
 * is only consulted when subdomain mode is off and the host is the platform
 * apex; when subdomain mode is on the parameter is ignored entirely.
 */
export const resolveTenantSlug = (
  host: string | null | undefined,
  searchParams: URLSearchParams | null | undefined,
  rootDomain: string | null | undefined = getAppRootDomain(),
): string | null => {
  const hostSlug = getTenantSlugFromHost(host, rootDomain);
  if (hostSlug) return hostSlug;
  if (!allowSubdomain()) return getTenantSlugFromParam(searchParams);
  return null;
};
