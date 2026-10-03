# saas_store API

Schema-per-tenant multi-tenant store (commerce) API.
NestJS 10 + TypeORM 0.3 + PostgreSQL 16, package manager: pnpm.

Global route prefix is `/api/v1`; Swagger UI is served at `/api/v1`.

## Setup

```bash
pnpm install
cp .env.example .env   # edit DB creds + secrets
pnpm start:dev
```

Postgres runs from `compose.yaml`. On boot the platform schema is seeded and a bootstrap
`SUPER_ADMIN` is created from `BOOTSTRAP_SUPER_ADMIN_EMAIL` / `BOOTSTRAP_SUPER_ADMIN_PASSWORD`
(boot fails if no super admin exists and those env vars are missing).

## Architecture & multi-tenancy

- **Public schema (`public`)** — platform layer: the `tenants` registry plus platform RBAC
  (`users`, `roles`, `permissions`, `role_permissions`) with `SUPER_ADMIN`, and the SaaS
  subscription tables (`subscription_plans` + limits/features, `subscriptions`,
  `tenant_usage_counters`). Platform auth is independent of tenant data.
- **Tenant schema (`tenant_<slug>`)** — isolated per store: `users`, `roles`, `permissions`,
  `role_permissions`, `user_permissions`, `products`, `product_images`, `categories`,
  `carts`, `cart_items`. The same email is allowed across tenants.
- **Resolution order** (`TenantResolutionService`, used by middleware and guard):
  `x-tenant-id` → `x-tenant-slug` → subdomain from `Host` minus `APP_ROOT_DOMAIN`.
  `TenantMiddleware` sets `req.tenant` plus an AsyncLocalStorage context; the guard enforces
  resolution on non-platform routes: **400** when no identifier is supplied, **404** when an
  identifier does not resolve.
- **Guard order** (global `APP_GUARD`): `TenantGuard` → `JwtGuard` → `PermissionGuard`.
  `@Public()` skips auth; `@Platform()` skips tenant resolution and rejects tokens carrying
  tenant claims; `@Roles([...])` requires one of the listed roles; `@Permissions([...])`
  requires **all** listed permissions. `SUPER_ADMIN` bypasses the role/permission checks.
- **JWT** — access/refresh tokens carry `type` (`access`|`refresh`), `id`, `role`, `tenantId`,
  `tenantSchema` (null for platform). Refresh rotates `jti`; a stored `user.jti` mismatch
  returns **401**. A tenant token on a `@Platform()` route returns **403**, as does a token
  whose `tenantSchema` does not match the resolved tenant.
- **`TenantManagerService`** — per-schema DataSource LRU cache (cap **100**) with in-flight
  dedupe, `synchronize: true` (dev-only; no migrations infrastructure), and
  `poolSize = TENANT_POOL_SIZE`. `release(tenant)` drops a cached datasource; all datasources
  are destroyed on module destroy.

## RBAC model

Roles are **identity only**. Authorization is the union of a user's direct grants and the
permissions attached to the user's role.

- **Roles**: `SUPER_ADMIN` (platform), `STORE_OWNER`, `ADMIN`, `CUSTOMER`.
  `ROLE_RANK`: SUPER_ADMIN `5`, STORE_OWNER `4`, ADMIN `3`, CUSTOMER `0`.
- **45 seeded permissions**, grouped as: users `6`, roles + permissions `8`, products `4`,
  categories `4`, cart `4`, orders `5`, coupons `5`, payments `3`, addresses `4`,
  subscriptions `2`.
- **`SEED_ROLE_PERMISSIONS`**:
  - `SUPER_ADMIN` / `STORE_OWNER` — all 45.
  - `ADMIN` — user create/read/update/assign-role/assign-permissions (no user delete),
    roles/permissions read, full catalog (products + categories) and full cart.
  - `CUSTOMER` — products/categories read and full cart.
- **On user creation**, `UsersService.create` copies the role's seed mapping
  (`SEED_ROLE_PERMISSIONS[roleKey] ?? []`) into the user's **direct** `user_permissions`.
- **`assignRole`** replaces the user's direct grants with the new role's seed mapping
  (`?? []` for custom roles). **`deassignRole`** sets `roleId = null` and **leaves direct grants
  untouched**.
- The `role_permissions` M2M still exists on `Role` and is seeded — it has not been removed.
- **Effective authorization is a union**: `JwtGuard` sets `request.user.permissions` to
  direct grants ∪ role permissions, deduplicated. This union is what `@Permissions()` checks.
- **`grantPermissions`** enforces the rank rule and, for callers below STORE_OWNER, only allows
  granting permissions the caller owns. **`revokePermissions`** with an empty list clears all
  direct grants.
- **Rank rule**: an actor cannot modify a user with equal or higher rank; `SUPER_ADMIN` may
  target rank ≤ its own.
- **Responses** serialize via `presentUser`: `role` is `{id, key, name}` or `null`, and
  `permissions` is the user's **direct grants only** (sorted by key) — not the effective union.

## Modules

- **`auth`** — `register`, `register-store`, `login`, `login/platform`, `refresh`.
  Flow: [`src/modules/auth/workflow.md`](src/modules/auth/workflow.md).
- **`users`** — profile, CRUD, assign/deassign role, grant/revoke permissions.
  Flow: [`src/modules/users/workflow.md`](src/modules/users/workflow.md).
- **`rbac`** — roles and permissions CRUD; system roles are protected and reserved role keys
  are rejected. Flow: [`src/modules/rbac/workflow.md`](src/modules/rbac/workflow.md).
- **`tenants` / `platform`** — provisioning, boot re-seed, and per-schema storage reporting.
  Flow: [`src/modules/tenants/workflow.md`](src/modules/tenants/workflow.md),
  [`src/modules/platform/workflow.md`](src/modules/platform/workflow.md).
- **`products`** — CRUD plus image upload/delete/reorder, backed by R2.
  Flow: [`src/modules/products/workflow.md`](src/modules/products/workflow.md).
- **`categories`** — CRUD; 8 base categories are seeded per tenant.
  Flow: [`src/modules/categories/workflow.md`](src/modules/categories/workflow.md).
- **`cart`** — one cart per user: `GET /cart`, add/update/remove items, clear; max **100**
  items per cart, max quantity **99** per line, with active/stock checks.
  See [`src/modules/cart/cart.service.ts`](src/modules/cart/cart.service.ts).
- **`subscriptions`** — platform-level SaaS plans with limits/features; Super Admin manages plans
  and assigns one plan per tenant, tenants read their own subscription/usage. Enforced limits:
  storage, database size, store admins, monthly coupons.
  Flow: [`src/modules/subscriptions/workflow.md`](src/modules/subscriptions/workflow.md).

## Subscriptions

Public-schema plans are created/edited by Super Admin; each tenant has exactly one subscription.

- **Super Admin routes** (`@Platform @Roles([SUPER_ADMIN])`):
  `GET|POST /platform/subscription-plans`, `GET|PATCH|DELETE /platform/subscription-plans/:id`,
  `GET /platform/tenants/:id/subscription` (current plan + subscription; falls back to `free`),
  `GET /platform/tenants/:id/subscription/usage` (per-key `{ used, limit, remaining }`),
  `PUT /platform/tenants/:id/subscription`, `PATCH /platform/tenants/:id/subscription/status`.
- **Tenant routes** (`subscriptions:read`): `GET /subscription` (own subscription only),
  `GET /subscription/plans` (active + public), `GET /subscription/usage`.
- **Limits**: `STORAGE_BYTES`, `DATABASE_BYTES`, `STORE_ADMINS`, `COUPONS_PER_MONTH`, `PRODUCTS`;
  unlimited = no row or `value IS NULL`. **Features** are cumulative booleans (Stripe payments,
  customization, coupons, staff management, import/export, custom domain, analytics, reports, SEO,
  audit logs, priority support).
- **Enforcement**: storage via the plan-synced `Tenant.storageCapacityBytes`; store admins counted
  (owner included) under a public subscription row lock; coupons via an atomic monthly counter
  (deleting a coupon does not refund quota); products capped by a live count of the tenant schema at
  product create; database size (`pg_total_relation_size`, tenant schema only) at checkout.
- Stripe SaaS billing is deferred; the `stripe*` columns are unused and customer Stripe Connect is
  untouched. No migrations: all subscription tables are created by `synchronize`.

## Seeding / bootstrap

All seeding lives in `src/modules/seeding/` behind a registry-driven module. Seeders are idempotent
and conflict-safe, so reruns are safe.

- **Boot** (`SeedingBootstrapService`) runs the platform seeders then the tenant seeders for every
  ACTIVE tenant. It throws (fails boot) when a platform seeder fails — e.g. no super admin exists and
  `BOOTSTRAP_SUPER_ADMIN_*` is unset — and only logs per-tenant failures.
- **Platform** (public schema): `permissions` (45), `roles` (`SUPER_ADMIN`), `super-admin`
  (bootstrap user), `subscription-plans` (`free`, `starter`, `growth`, `pro`, `enterprise`),
  `subscription-backfill` (assign `free` + re-sync storage capacity).
- **Tenant**: `permissions`, `roles` (`STORE_OWNER`, `ADMIN`, `CUSTOMER`), plus the **opt-in**
  `categories` (`BASE_CATEGORIES`), which is not run by provision/reseed or boot.
- `TenantProvisionerService.provision(tenant)` — `CREATE SCHEMA IF NOT EXISTS` → tenant DataSource →
  `seedRbac(TENANT_ROLE_KEYS)`. All seeding logic lives under `src/modules/seeding/`.

### CLI

`test/seed.ts`, booting the app context with `SEED_CLI=true`. Default (no mode flag) runs platform
then ACTIVE tenants.

```bash
pnpm --filter saas_store_api seed                                   # platform + all ACTIVE tenants
pnpm --filter saas_store_api seed:platform                          # platform only
pnpm --filter saas_store_api seed:tenants                           # all ACTIVE tenants
pnpm --filter saas_store_api seed -- --name permissions             # one seeder (both scopes)
pnpm --filter saas_store_api seed -- --tenants --name roles         # tenant roles only
pnpm --filter saas_store_api seed -- --tenants --name categories    # opt-in base categories
pnpm --filter saas_store_api seed -- --tenant demo                  # single tenant (id or slug)
```

Flags: `--platform`, `--tenants`, `--all` (default), `--name <n>` (repeatable/comma-separated),
`--tenant <id|slug>`, `--force`. In production both `SEED_ALLOW_PRODUCTION=true` and `--force` are
required; `--force` alone never bypasses the environment guard. The CLI exits non-zero on failure.

## Storage

- `R2Service` (Cloudflare R2); object keys are `tenants/{schema}/products/{uuid}.{ext}`.
- Uploads: max **5** files/request, allowed types `jpeg`, `png`, `webp`, `MAX_FILE_SIZE`
  (default `5242880`, i.e. 5 MB fallback), `MAX_PRODUCT_IMAGES` (default `5`), and a per-tenant
  quota mirrored from the assigned plan's `STORAGE_BYTES` limit (`Tenant.storageCapacityBytes`;
  `TENANT_STORAGE_CAPACITY_BYTES` is only the default before a plan is assigned).
- A partial upload failure rolls back already-uploaded objects; deleting a product or image
  deletes the corresponding R2 objects.
- Platform `GET /platform/tenants` and `GET /platform/tenants/:id`, plus `GET /dashboard/stats`,
  report the per-schema Postgres size as `schemaSizeBytes` via `pg_total_relation_size`, with a
  display-only `schemaCapacityBytes` from `TENANT_DB_CAPACITY_BYTES` (a failed query reports `0`).

## Commands

| Command | Description |
| --- | --- |
| `pnpm start:dev` | Watch mode (needs Postgres from `compose.yaml`) |
| `pnpm build` | Build to `dist/` (`nest build`) |
| `pnpm start:prod` | Run the build (`node dist/main`) |
| `pnpm lint` | eslint `--fix` over `{src,apps,libs,test}` |
| `npx tsc --noEmit` | Typecheck |
| `pnpm test` | Jest unit specs (`src/**/*.spec.ts`) |
| `pnpm test:e2e` | Jest with `test/jest-e2e.json` |

## Dev DB reset

Drops all `tenant_*` schemas and truncates the public auth/tenant tables. Restart the app
afterwards to re-bootstrap the super admin.

```bash
npx ts-node -r tsconfig-paths/register test/reset-dev-db.ts
```

## Verification scripts

Each boots the app, exercises flows, and cleans up.

```bash
npx ts-node -r tsconfig-paths/register test/verify-tenant-provision.ts     # schema + RBAC seed
npx ts-node -r tsconfig-paths/register test/verify-tenant-guard.ts         # cross-tenant 403
npx ts-node -r tsconfig-paths/register test/verify-tenant-lifecycle.ts     # tenant CRUD + isolation
npx ts-node -r tsconfig-paths/register test/verify-register-store-guard.ts # self-serve signup + guard isolation
```

## Endpoint reference

Paths below include the global `/api/v1` prefix. Tenant-scoped routes additionally require a
resolved tenant (`x-tenant-id` / `x-tenant-slug` / subdomain) and a matching Bearer token.

### Auth — `/api/v1/auth`

| Method | Path | Guard / permission |
| --- | --- | --- |
| POST | `/api/v1/auth/register` | `@Public`, tenant-scoped; creates a `CUSTOMER` |
| POST | `/api/v1/auth/register-store` | `@Public` + `@Platform`; provisions tenant + `STORE_OWNER`, returns tokens |
| POST | `/api/v1/auth/login` | `@Public`, tenant-scoped |
| POST | `/api/v1/auth/login/platform` | `@Public` + `@Platform`; `SUPER_ADMIN` only |
| POST | `/api/v1/auth/refresh` | `@Public` + `@Platform`; rotates `jti` |

### Users — `/api/v1/users`

| Method | Path | Guard / permission |
| --- | --- | --- |
| GET | `/api/v1/users/profile` | Auth only (no permission) |
| GET | `/api/v1/users/profile/:id` | `users:read` |
| GET | `/api/v1/users` | `users:read` |
| PATCH | `/api/v1/users/:id` | `users:update` |
| DELETE | `/api/v1/users/:id` | `users:delete` |
| PATCH | `/api/v1/users/:id/role` | `users:assign_role` |
| DELETE | `/api/v1/users/:id/role` | `users:assign_role` |
| POST | `/api/v1/users/:id/permissions` | `users:assign_permissions` |
| DELETE | `/api/v1/users/:id/permissions` | `users:assign_permissions` |

### Roles — `/api/v1/roles`

| Method | Path | Guard / permission |
| --- | --- | --- |
| GET | `/api/v1/roles` | `roles:read` |
| GET | `/api/v1/roles/:id` | `roles:read` |
| POST | `/api/v1/roles` | `roles:create` |
| PATCH | `/api/v1/roles/:id` | `roles:update` |
| DELETE | `/api/v1/roles/:id` | `roles:delete` |

System role keys cannot be changed and system roles cannot be deleted; reserved role keys
are rejected.

### Permissions — `/api/v1/permissions`

| Method | Path | Guard / permission |
| --- | --- | --- |
| GET | `/api/v1/permissions` | `permissions:read` |
| POST | `/api/v1/permissions` | `permissions:create` |
| PATCH | `/api/v1/permissions/:id` | `permissions:update` |
| DELETE | `/api/v1/permissions/:id` | `permissions:delete` |

### Products — `/api/v1/products`

| Method | Path | Guard / permission |
| --- | --- | --- |
| GET | `/api/v1/products` | `products:read` |
| GET | `/api/v1/products/:id` | `products:read` |
| POST | `/api/v1/products` | `products:create` |
| PATCH | `/api/v1/products/:id` | `products:update` |
| DELETE | `/api/v1/products/:id` | `products:delete` |
| POST | `/api/v1/products/:id/images` | `products:update` (multipart `files[]`, max 5) |
| DELETE | `/api/v1/products/:id/images/:imageId` | `products:update` |
| PATCH | `/api/v1/products/:id/images/order` | `products:update` |

### Categories — `/api/v1/categories`

| Method | Path | Guard / permission |
| --- | --- | --- |
| GET | `/api/v1/categories` | `categories:read` |
| GET | `/api/v1/categories/:id` | `categories:read` |
| POST | `/api/v1/categories` | `categories:create` |
| PATCH | `/api/v1/categories/:id` | `categories:update` |
| DELETE | `/api/v1/categories/:id` | `categories:delete` |

### Cart — `/api/v1/cart`

| Method | Path | Guard / permission |
| --- | --- | --- |
| GET | `/api/v1/cart` | `cart:read` |
| POST | `/api/v1/cart/items` | `cart:create` |
| PATCH | `/api/v1/cart/items/:productId` | `cart:update` |
| DELETE | `/api/v1/cart/items/:productId` | `cart:delete` |
| DELETE | `/api/v1/cart` | `cart:delete` |

### Platform — `/api/v1/platform/tenants`

All routes are `@Platform` + `@Roles(SUPER_ADMIN)`.

| Method | Path | Guard / permission |
| --- | --- | --- |
| GET | `/api/v1/platform/tenants` | `@Platform` + `@Roles(SUPER_ADMIN)` |
| GET | `/api/v1/platform/tenants/:id` | `@Platform` + `@Roles(SUPER_ADMIN)` |
| PATCH | `/api/v1/platform/tenants/:id/toggle-active` | `@Platform` + `@Roles(SUPER_ADMIN)` |

### Health — `/api/v1/health/storage`

| Method | Path | Guard / permission |
| --- | --- | --- |
| GET | `/api/v1/health/storage` | `@Public` + `@Platform`; reports R2 connectivity |

See `postman/saas_store.postman_collection.json` for a runnable request collection.
