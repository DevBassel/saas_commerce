# saas_store API

NestJS 10 + TypeORM 0.3 + PostgreSQL. Schema-per-tenant multi-tenant store API.

## Model

- **Public schema (`public`)** — platform layer: `tenants` registry + SUPER_ADMIN (`user`, `roles`, `permissions`). Platform auth independent of tenant data.
- **Tenant schema (`tenant_<slug>`)** — isolated per store: `user`, `roles`, `permissions`, `user_permissions`. Same email allowed across tenants.
- **Resolution** — subdomain from `Host` (root via `APP_ROOT_DOMAIN`), or dev override headers `x-tenant-slug` / `x-tenant-id`. Platform routes (`/platform/*`, `/auth/register-store`, `/auth/login/platform`) skip tenant.
- **JWT** — access/refresh tokens carry `tenantId` + `tenantSchema`. `JwtGuard` loads the user from the matching tenant schema; resolved tenant ≠ token tenant → `403`.
- **AsyncLocalStorage** — set by `TenantMiddleware` (`run()`); services resolve the tenant datasource via `TenantManagerService` from it.

## Setup

```bash
pnpm install
cp .env.example .env   # edit DB creds + secrets
pnpm start:dev
```

Boot seeds public `SUPER_ADMIN` from `BOOTSTRAP_SUPER_ADMIN_EMAIL` / `BOOTSTRAP_SUPER_ADMIN_PASSWORD`.

## Dev DB reset

Drops all `tenant_*` schemas and truncates public auth/tenant tables. Restart app after to re-bootstrap super admin.

```bash
npx ts-node -r tsconfig-paths/register test/reset-dev-db.ts
```

## Verification scripts

Each boots the app, exercises flows, cleans up.

```bash
npx ts-node -r tsconfig-paths/register test/verify-tenant-provision.ts  # schema + RBAC seed
npx ts-node -r tsconfig-paths/register test/verify-tenant-guard.ts      # cross-tenant 403
npx ts-node -r tsconfig-paths/register test/verify-tenant-lifecycle.ts  # full tenant CRUD + isolation
```

## Commands

```bash
pnpm build          # nest build
pnpm lint           # eslint --fix
npx tsc --noEmit    # typecheck
pnpm start:dev      # watch mode
```

## Key endpoints

- `POST /api/v1/auth/register-store` — provision tenant + STORE_OWNER, returns tokens
- `POST /api/v1/auth/register` — create CUSTOMER in resolved tenant (needs tenant header/subdomain)
- `POST /api/v1/auth/login` — tenant-scoped login
- `POST /api/v1/auth/login/platform` — public SUPER_ADMIN login
- `GET /api/v1/platform/tenants`, `GET /api/v1/platform/tenants/:id` — SUPER_ADMIN only
- Users / Roles / Permissions CRUD — tenant-scoped via header/subdomain + Bearer token

See `postman/saas_store.postman_collection.json`.
