/**
 * Back-compat re-export. Host classification now lives in `./host`; the
 * root-domain-aware `getTenantSlugFromHost` is defined there. Import from
 * `@/lib/tenant/host` for new code.
 */
export { getTenantSlugFromHost } from "./host";
