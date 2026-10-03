# System Patterns — saas_commerce

Architecture and the technical decisions behind it. Detailed rules live in
`apps/api/AGENTS.md`; this file records the shape and the rationale.

## High-level architecture

```
Browser (store subdomain)                 Browser (admin subdomains)
   tenant_store (Next 16)                   super_admin_dash / store_owner_dashboard
        |  NEXT_PUBLIC_BACKEND_URL              |  VITE_API_URL
        +--------------------+------------------+
                             v
                 NestJS API (/api/v1, port 4000)
        TenantMiddleware -> TenantGuard -> JwtGuard -> PermissionGuard -> ThrottlerGuard
                             |
             +---------------+----------------+
             v                                v
     public schema (tenants,            tenant_<slug> schema
     platform users/roles/perms)        (products, orders, ...)
                             |
                    TenantManagerService (LRU DataSource cache)
```

## Key patterns and decisions

- **Schema-per-tenant isolation.** Isolation is physical (PostgreSQL schemas), not row-level.
  Resolved per request and carried in AsyncLocalStorage. Rationale: strong isolation with one
  connection pool per schema and simple per-tenant teardown.
- **DataSource manager.** `TenantManagerService` caches one DataSource per schema (LRU cap 100,
  in-flight dedupe, move-to-front, destroy on eviction). `getRepository(entity, tenant)` takes an
  explicit `TenantRef` — it does not read AsyncLocalStorage. Context enforcement lives in
  `tenant-scope.ts` (`requireTenantContext` → 403).
- **Guard order is load-bearing:** `TenantGuard → JwtGuard → PermissionGuard → ThrottlerGuard`.
  Tenant must resolve before the JWT can be matched against `tenantId`/`tenantSchema`.
- **Auth is stateless JWT with rotation.** Access + refresh use separate secrets; refresh rotates
  `jti` and rejects a stored `user.jti` mismatch. Refresh is single-flight in every client.
- **Entity placement rule:** tenant entities go in `src/modules/tenants/utils/tenant-entities.ts`;
  never add a tenant entity to `PUBLIC_ENTITIES` in `src/core.module.ts`.
- **Public vs tenant repository access:** tenant data via `getRepository` / tenant-scope helpers;
  public data via `@InjectRepository` on the public DataSource.
- **Transactional coupon consumption:** inside checkout, always use the passed `EntityManager`
  (pessimistic lock on the coupon row), never `tenantManager.getRepository`, or writes escape the
  transaction.
- **PaymentIntent-first:** Stripe PaymentIntent is created before the `Payment` row is persisted,
  the inverse of the older documented design. Stripe is called directly (no provider seam).
- **Frontends derive the tenant slug from the `Host` first label**; super admin never sends the
  header. Frontends are not the security boundary — the API is.

## Cross-cutting contracts

- API base path `/api/v1`; tenant header `x-tenant-slug`; bearer access tokens; rotating refresh.
- Load-bearing, byte-identical identifiers (never rename): package names, Compose project/container
  names, `DB_NAME`, `R2_BUCKET`, `APP_NAME`, JWT `issuer`/`audience`, and the dashboards'
  `localStorage` token keys and sign-in labels. See root `AGENTS.md`.

## Known quirks that shape work

- `PaymentsModule` provides its **own** `TenantManagerService` instance (a second DataSource cache).
- `R2Module` lists `TenantModule` as a provider rather than importing it.
- `PaymentsService` writes non-column properties (`canceledAt`/`failedAt`) — silent no-ops.
- `super_admin_dash` `authProvider.getIdentity` shape does not match what `UserAvatar`/`UserInfo`
  expect, so avatar initials/identity text render blank.
