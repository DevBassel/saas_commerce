# PLAN — Multi-Tenant Schema-per-Tenant Conversion

Status: approved. NestJS 10 + TypeORM 0.3 + PostgreSQL.

## Goal
Convert single-schema app → schema-per-tenant isolation. Each tenant = own Postgres schema `tenant_<slug>`. Platform layer in `public`.

## Architecture (summary)
- **Public (`public`)**: `tenants` table + SUPER_ADMIN auth (`users/roles/permissions` minimal). Same entity classes as tenant DS.
- **Per-tenant (`tenant_<slug>`)**: replicated `users/roles/permissions/role_permissions` + future commerce. True isolation. Same email OK across tenants.
- **Resolution**: subdomain from `Host` (root domain via `APP_ROOT_DOMAIN`), dev override `x-tenant-slug`/`x-tenant-id`. Platform routes skip tenant.
- **JWT**: carries `tenantId` + `tenantSchema`. JwtGuard cross-check resolved vs token → mismatch = 403.
- **TypeORM**: `TenantManagerService` caches DataSource per tenant, options `{ schema: tenant_<slug> }`. Tenant DS `synchronize=true`, explicit `entities` array (`autoLoadEntities:false`), `poolSize` from `TENANT_POOL_SIZE`, LRU eviction, close on deactivate.
- **Auth**: register-store provisions tenant; register/login tenant-scoped; `login/platform` = public DS SUPER_ADMIN.

---

## Phase 1 — Tenant entity + module + env keys
Goal: platform layer holds tenant registry. No behavior change yet.

Tasks:
- New `src/modules/tenants/entities/tenant.entity.ts` — public schema: `id, name, slug, schemaName, subdomain, status, ownerUserId?, createdAt, updatedAt`. Unique indexes on slug/schemaName/subdomain.
- New `src/modules/tenants/tenant.module.ts`, `tenant.service.ts` (basic CRUD stubs), `dto/create-tenant.dto.ts`.
- Register `Tenant` in `core.module.ts` public DS (`autoLoadEntities` covers it via `TypeOrmModule.forFeature` in TenantModule).
- `env.schema.ts` + `.env.example`: add `APP_ROOT_DOMAIN`, `TENANT_POOL_SIZE`.

Done criteria:
- `npx tsc --noEmit` + `pnpm lint` pass.
- Boot smoke: `GET /api/v1/...` still works, tenant table exists.

---

## Phase 2 — TenantManager + provisioner + RBAC seed refactor
Goal: infrastructure to create/switch tenant schemas.

Tasks:
- `tenant-manager.service.ts` — Map cache tenant→DataSource. `getDataSource(tenant)`, `getRepository(entity, tenant)`. Lazy init: new DataSource from base config + `{ schema, entities, synchronize, poolSize }`. LRU eviction cap (e.g. 100), close on evict.
- `tenant-provisioner.service.ts` — `provision(tenant)`: `CREATE SCHEMA tenant_<slug>` (sanitized), build+initialize DS, run RBAC seed against it, cache.
- Refactor `rbac.service.ts` — `seed(ds: DataSource)` callable against arbitrary DS. Keep platform seed via public DS. Roles seeded per tenant: STORE_OWNER..CUSTOMER + ALL permissions (no SUPER_ADMIN in tenant).
- Tenant DS entities list = `[User, Role, Permission]` (+ future).

Done criteria:
- Build/lint/typecheck pass.
- Unit-ish boot: provisioner can create schema + tables + seed on demand (verified via node fetch test script).

---

## Phase 3 — Tenant resolution guard + ALS context
Goal: request → tenant resolved, stored in context.

Tasks:
- New `src/modules/auth/tenant-context.ts` — AsyncLocalStorage: `{ tenant, tenantSchema }`.
- New `src/modules/auth/guards/tenant.guard.ts` — parse `Host` subdomain (strip `APP_ROOT_DOMAIN`), fallback `x-tenant-slug`/`x-tenant-id` header, look up `tenants` (public repo), throw 404/400 on unknown. Set ALS. Skip for routes marked platform (e.g. `login/platform`, `/platform/*`, public `register-store`).
- Update `RequestWithUser.interface.ts` — add `tenant?: Tenant`.
- Register guard global in `app.module.ts` (after JwtGuard/PermissionGuard or before — platform skip logic decides).

Done criteria:
- Build pass. Request with header/subdomain populates ALS; wrong tenant → 404/403.

---

## Phase 4 — Auth refactor + JWT tenant claims
Goal: register/register-store/login produce tenant-aware tokens.

Tasks:
- `auth.service.ts`:
  - `registerStore`: create `tenants` row → `tenant-provisioner.provision()` → create STORE_OWNER in tenant DS → tokens with `{id, role, tenantId, tenantSchema}`.
  - `register`: create CUSTOMER in resolved tenant DS (ALS context).
  - `login`: resolve tenant (guard/ALS) → find user in tenant DS → verify → tokens + tenant claims.
  - `loginPlatform`: public DS SUPER_ADMIN login.
  - `refresh_user_credentials`: tenant from token claim; re-issue same tenant.
- `auth.controller.ts`: add `POST /auth/login/platform`.
- `jwt-payload.dto.ts`: add `tenantId`, `tenantSchema`.

Done criteria:
- Flow verified via node fetch: register-store → tokens → login tenant user → login platform → refresh.

---

## Phase 5 — JwtGuard tenant-aware binding
Goal: authed requests run in correct schema; cross-tenant blocked.

Tasks:
- `jwt.guard.ts`:
  - Verify token. Super admin (public DS user, role SUPER_ADMIN) → public schema path.
  - Non-super: get tenant DS from `tenantSchema` claim via TenantManager. Load user there. Attach `req.user` + `req.tenant`.
  - Mismatch check: resolved tenant (ALS/guard) vs token `tenantSchema` → if resolved tenant present and differs → 403. If no tenant context (missing subdomain/header on tenant route) → 401/403.
- Refresh guard path consistent.

Done criteria:
- Cross-tenant test: tenant A token on tenant B subdomain → 403.

---

## Phase 6 — Services → TenantManager repos
Goal: tenant-scoped services use dynamic repos.

Tasks:
- `users.service.ts` — replace `@InjectRepository(User/Role)` (tenant ops) with `TenantManager.getRepository(..., tenantFromALS)`. Keep public DI where global.
- `rbac.service.ts` — tenant CRUD via TenantManager; platform seed via public DS.
- Remove `TypeOrmModule.forFeature([User, Role])` from tenant-facing modules where no longer static (keep for public entities only).

Done criteria:
- Full flow works: register-store → login → user CRUD → role CRUD → permission CRUD, all inside one tenant schema. Second tenant isolated.

---

## Phase 7 — Platform tenants endpoints
Goal: super admin manages tenants.

Tasks:
- `platform.controller.ts` → `GET /platform/tenants`, `GET /platform/tenants/:id` (from `tenants` repo). Drop `/stores` endpoints (or alias).
- Keep `@Roles([SUPER_ADMIN])`; super admin resolved via public DS.

Done criteria:
- `GET /platform/tenants` lists registry; `/platform/tenants/:id` returns one.

---

## Phase 8 — Bootstrap super admin → public schema
Goal: platform auth independent of tenant data.

Tasks:
- Rework boot: seed public `users/roles/permissions` minimal (SUPER_ADMIN + platform perms). `BOOTSTRAP_SUPER_ADMIN_EMAIL` creates SUPER_ADMIN in public DS.
- `BOOTSTRAP_STORE_OWNER_EMAIL`: repurpose → creates initial tenant + owner via provisioner, or remove.
- Verify login/platform works before any tenant exists.

Done criteria:
- Fresh boot: super admin exists in public; can login/platform; no tenant required.

---

## Phase 9 — Dev data migration/reset
Goal: clean transition from single-schema data.

Tasks:
- Dev DB reset (drop + recreate) OR one-time script: create initial tenant schema from existing STORE_OWNER + move users.
- Update `.env.example` / README with reset instructions.

Done criteria:
- Fresh DB boots clean; initial tenant provisioned; old single-schema data gone.

---

## Phase 10 — Postman + memory + verify
Goal: docs + regression pass.

Tasks:
- Update `postman/saas_store.postman_collection.json`: tenant header, new endpoints, login/platform.
- Update `memory.md`: module map, endpoints, guards order, quirks.
- Run `pnpm lint`, `npx tsc --noEmit`, `pnpm build`.
- Boot smoke via node fetch script: full tenant lifecycle.

Done criteria:
- Lint/typecheck/build clean. Smoke script green. Docs current.

---

## Risks / notes
- Pool per tenant → PG connection ceiling. Mitigate `TENANT_POOL_SIZE`, LRU eviction, close on deactivate.
- `synchronize` per schema = dev-only. Migrations infra deferred.
- Slug sanitization: `[a-z0-9-]`, lowercase, unique, ≤63 bytes.
- Subdomain parse edge cases (localhost, IP, port): dev uses header override.
- Same entity classes shared public/tenant DS — schema set via DS options, not decorator.
