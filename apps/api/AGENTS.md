# AGENTS.md — saas_store

Schema-per-tenant multi-tenant store (commerce) API.
NestJS 10 + TypeORM 0.3 + PostgreSQL 16. Package manager: pnpm.

## Commands

- `pnpm install`
- `pnpm start:dev` — watch mode (needs Postgres from `compose.yaml`)
- `pnpm build` / `pnpm start:prod` (runs `node dist/main`)
- `pnpm lint` — eslint --fix over src/test
- `npx tsc --noEmit` — typecheck
- `pnpm test` — jest, unit specs `src/**/*.spec.ts`
- `pnpm test:e2e` — jest config `test/jest-e2e.json`
- Integration verify scripts (boot the app, need `.env` + Postgres):
  `npx ts-node -r tsconfig-paths/register test/verify-tenant-provision.ts | verify-tenant-guard.ts | verify-tenant-lifecycle.ts | verify-register-store-guard.ts`
- Dev DB reset (drops `tenant_*` schemas, truncates public auth/tenant tables; restart to re-bootstrap):
  `npx ts-node -r tsconfig-paths/register test/reset-dev-db.ts`

## Layout

- `src/main.ts` — bootstrap: global prefix `/api/v1`, Swagger UI at `/api/v1`,
  global `ValidationPipe` (whitelist + forbidNonWhitelisted + transform),
  `ClassSerializerInterceptor` (strips `@Exclude`), CORS, listen on `APP_PORT`.
- `src/app.module.ts` — global guard order matters: **TenantGuard → JwtGuard → PermissionGuard** (`APP_GUARD`);
  `TenantMiddleware` applied to all routes.
- `src/core.module.ts` — global Config (Joi), pino logger, R2 storage, global JwtModule, public-schema TypeORM DataSource.
  Public entities only: `[Tenant, User, Role, Permission]`.
- `src/common/` — `config/` (env schema + typed groups), `logger/` (pino → rotating file, TypeORM daily logger),
  `storage/` (Cloudflare R2 via `@aws-sdk/client-s3`), `constants/` (`RoleKey`+`ROLE_RANK`, `PermissionKey`).
- `src/modules/` — `auth`, `users`, `rbac`, `tenants`, `platform`, `products`, `categories`.
  Each has a `workflow.md` mermaid diagram — treat those as the authoritative flow docs.

## Multi-tenancy model

- **public schema**: `tenants` registry + platform RBAC (`users/roles/permissions`) with `SUPER_ADMIN`.
- **tenant schema `tenant_<slug>`**: isolated `users/roles/permissions/user_permissions` + `products/product_images/categories`.
  Same email is allowed across tenants.
- **Resolution** (`TenantResolutionService`, used by both middleware and guard):
  `x-tenant-id` → `x-tenant-slug` → subdomain from `Host` minus `APP_ROOT_DOMAIN`.
  Middleware sets `req.tenant` + AsyncLocalStorage (`tenant-context.ts`); guard enforces on non-platform API routes
  (400 when no identifier at all, 404 when identifier does not resolve).
- **TenantManagerService**: per-schema DataSource LRU cache (cap 100), in-flight dedupe, `synchronize: true`,
  explicit `TENANT_ENTITIES`, `poolSize = TENANT_POOL_SIZE`; `release()` on deactivate and destroy-all on module destroy.
  Tenant services use `getRepository(entity, tenant)`, falling back to public repos when no tenant context (users/rbac).
- **Guards**: `@Public()` skips auth; `@Platform()` routes skip tenant resolution and reject tokens carrying tenant claims;
  tenant routes require token `tenantSchema === resolved schemaName` (else 403). `PermissionGuard`: SUPER_ADMIN bypass,
  then `@Roles()` check, then `@Permissions()` (all required).
- **JWT**: claims `type` (access|refresh), `id`, `role`, `tenantId`, `tenantSchema` (null for platform).
  Separate access/refresh secrets + `issuer`/`audience`. Refresh rotates `jti`; stored `user.jti` mismatch → 401.

## Data model

- `Tenant` (public): `id, name, slug(unique), schemaName(unique), subdomain(unique), status(ACTIVE|INACTIVE), ownerUserId, storageCapacityBytes`.
- Tenant-scoped: `User` (role + direct permissions via `user_permissions`, `jti` excluded from serialization),
  `Role` (system roles protected), `Permission`, `Category` (unique slug), `Product` (unique `sku`, numeric(10,2) price,
  `categoryId` FK ON DELETE SET NULL), `ProductImage` (position-ordered, R2 object key).
- Never add tenant entities to `PUBLIC_ENTITIES` in `core.module.ts`; add them to `src/modules/tenants/tenant-entities.ts`.

## Seeding / bootstrap

- `RbacSeedService.onApplicationBootstrap`: seeds **public** schema — 21 permissions + `SUPER_ADMIN` role,
  then ensures a bootstrap super admin from `BOOTSTRAP_SUPER_ADMIN_*` (throws at boot if none exists and env is missing).
- `TenantProvisionerService.provision(tenant)`: `CREATE SCHEMA IF NOT EXISTS` → tenant DataSource →
  `seedRbac(tenant roles)` → `seedCategories` (8 base categories).
- `TenantReseedService.onApplicationBootstrap`: re-seeds all ACTIVE tenants on every boot (synchronize + RBAC/category backfill).

## Storage

- `R2Service` (Cloudflare R2); object keys `tenants/{schema}/products/{uuid}.{ext}`.
- Uploads: max 5 files/request, jpeg/png/webp/gif, `MAX_FILE_SIZE`, per-tenant quota from
  `TENANT_STORAGE_CAPACITY_BYTES`; partial failure rolls back uploaded objects.
- Platform `GET /platform/tenants` reports per-schema storage via `pg_total_relation_size`.

## Environment

- `.env.example` is the source of truth. Joi-validated at boot (`src/common/config/env.schema.ts`).
  Production boot fails on secrets < 32 chars or placeholder values.
- Groups: `app` (APP__, root domain, bootstrap super admin), `db` (DB__, TENANT_POOL_SIZE, TENANT_STORAGE_CAPACITY_BYTES),
  `jwt`, `bcrypt`, `log`, `cors`, `r2`, `files` (MAX_FILE_SIZE, MAX_PRODUCT_IMAGES).
- Access via `ConfigService<IENV>` typed groups in `env.interface.ts`; read with `getOrThrow<IX>('group')`.

## Conventions / quirks

- Inject repositories for tenant data via `TenantManagerService.getRepository(entity, tenant)`; public/global data uses
  standard `@InjectRepository` on the public DataSource.
- DTO validation with class-validator; global pipe rejects unknown fields (no extra body props).
- `synchronize: true` per tenant schema is dev-only; there is no migrations infrastructure.
- `src/...` import alias works via tsconfig `baseUrl` + jest `moduleNameMapper`; relative imports also used.
- `docs/` holds historical planning artifacts (`PLAN.md`, `audit-report.md`, `CLEANUP_PLAN.md`) — not current-state docs.
