# AGENTS.md — apps/api (`saas_store_api`)

Schema-per-tenant multi-tenant commerce API. NestJS 10 + TypeORM 0.3 + PostgreSQL 16.
Package manager: pnpm (single workspace; run installs from the repository root).

This file is the authoritative architecture reference for the API. The root `AGENTS.md` covers
cross-app contracts; the frontends' own `AGENTS.md` files describe their clients.

## Commands

Run from the repository root with a filter, or from `apps/api` directly.

- `pnpm --filter saas_store_api dev` — watch mode (`nest start --watch`; alias `start:dev`).
  Needs Postgres from the root `compose.yaml` and a real `apps/api/.env`.
- `pnpm --filter saas_store_api build` — `nest build`.
- `pnpm --filter saas_store_api start:prod` — `node dist/main`.
- `pnpm --filter saas_store_api lint` — `eslint "{src,apps,libs,test}/**/*.ts" --fix`.
- `pnpm --filter saas_store_api typecheck` — `tsc --noEmit`.
- `pnpm --filter saas_store_api test` — Jest unit specs (`src/**/*.spec.ts`, config inline in
  `package.json`; `moduleNameMapper` maps `src/*`, coverage excludes DTOs/modules/enums/entities).
- `pnpm --filter saas_store_api test:e2e` — Jest config `test/jest-e2e.json`.

Manual integration scripts (boot the app; need `.env` + live Postgres):

```bash
npx ts-node -r tsconfig-paths/register test/verify-tenant-provision.ts
npx ts-node -r tsconfig-paths/register test/verify-tenant-guard.ts
npx ts-node -r tsconfig-paths/register test/verify-tenant-lifecycle.ts
npx ts-node -r tsconfig-paths/register test/verify-register-store-guard.ts
npx ts-node -r tsconfig-paths/register test/reset-dev-db.ts   # drops tenant_* schemas, truncates public auth tables
npx ts-node -r tsconfig-paths/register test/seed-load-test.ts  # seeds >=10 tenants for the k6 load tests (load-tests/k6)
```

`verify-tenant-provision.ts` confirms the tenant `User` table is named `user` (singular).
`seed-load-test.ts` is idempotent, writes `load-tests/k6/data/dataset.json`, and is driven by
`K6_TENANTS`/`K6_USERS_PER_TENANT`/`K6_PRODUCTS_PER_TENANT`/`K6_PASSWORD` (see
`load-tests/k6/README.md`).

## Layout

- `src/main.ts` — bootstrap. `NestFactory.create(AppModule, { rawBody: true })`; `helmet` with
  `contentSecurityPolicy: false` so Swagger UI works; CORS via `buildCorsOrigin`; Swagger UI and
  global prefix both at `/api/v1` (`app.setGlobalPrefix`, no Nest URI versioning); global
  `ValidationPipe({ whitelist, forbidNonWhitelisted, transform })`; global
  `ClassSerializerInterceptor` (strips `@Exclude`); `listen(APP_PORT)`. There is no global exception
  filter.
- `src/app.module.ts` — imports all feature modules and registers five global guards in this exact
  order: **TenantGuard → JwtGuard → PermissionGuard → SubscriptionGuard → ThrottlerGuard**.
  `TenantMiddleware` is applied to `*`.
- `src/core.module.ts` — global `ConfigModule` (Joi `EnvSchema`, typed env load), global
  `JwtModule` (access secret/expiry), `ThrottlerModule`, pino logger, R2 module, and the
  public-schema TypeORM DataSource. `PUBLIC_ENTITIES = [Tenant, User, Role, Permission,
  CurrencyChangeRequest, SubscriptionPlan, SubscriptionPlanLimit, SubscriptionPlanFeature,
  Subscription, TenantUsageCounter]`.
- `src/common/` — `config/` (env schema, typed groups, `cors.util.ts`, `data-source.factory.ts`),
  `logger/` (pino to rotating file, TypeORM daily logger), `storage/` (`R2Service` on
  `@aws-sdk/client-s3`), `health/` (`GET health`), `db/` (`money-column`, `unique-retry`),
  `constants/` (`RoleKey` + `ROLE_RANK`, `PermissionKey` union, `currency.enum`).
- `src/modules/` — `auth`, `users`, `rbac`, `tenants`, `platform`, `products`, `categories`, `cart`,
  `orders`, `coupons`, `payments`, `addresses`, `dashboard`, `currency-requests`, `storefront`,
  `subscriptions`.

Most modules contain a `workflow.md` mermaid diagram; treat those as the authoritative flow docs for
that module. The root `workflow.md` documents the full request pipeline.

## Multi-tenancy

- **Public schema**: `tenants` registry plus platform RBAC (`user`, `roles`, `permissions`) with the
  `SUPER_ADMIN` role. The platform user table is named `user` (singular), not `users`.
- **Tenant schema `tenant_<slug>`**: isolated `user`, `roles`, `permissions`, `user_permissions`,
  `products`, `product_images`, `categories`, `carts`, `cart_items`, `orders`, `order_items`,
  `payments`, `addresses`, `coupons`, `coupon_redemptions`. The same email may exist across tenants.
- **Resolution** (`TenantResolutionService`, shared by middleware and guard): `x-tenant-id` →
  `x-tenant-slug` → subdomain of `Host` minus `APP_ROOT_DOMAIN`.
- **TenantMiddleware** acts only on API paths (`/api/v1`, `/api/v1/**`, `/api/v1-json*`). On a hit it
  sets `req.tenant` and runs the rest of the request inside AsyncLocalStorage (`tenant-context.ts`).
  On a miss it calls `next()` silently so public/platform routes still work.
- **TenantGuard** passes `@Platform()` routes and non-API paths. No identifier at all → 400. An
  identifier that does not resolve → 404. Inactive tenant → 403 (`tenant-policy.ts`).
- **TenantManagerService** owns one DataSource per schema in an LRU cache (cap 100, in-flight
  dedupe, move-to-front on hit, destroy on eviction/module destroy). Options:
  `entities: TENANT_ENTITIES`, `poolSize: TENANT_POOL_SIZE`,
  `synchronize = DB_SYNCHRONIZE && (NODE_ENV !== 'production' || DB_SYNCHRONIZE_TENANTS)`.
  `getRepository(entity, tenant)` takes an explicit `TenantRef` and returns a `Promise<Repository>`;
  it does not read AsyncLocalStorage itself. The throw-when-no-context behavior lives in
  `tenant-scope.ts` (`requireTenantContext` → 403).
- Tenant services resolve repositories with `getRepository` or the `tenant-scope` helpers. Platform
  and other public-schema work uses `@InjectRepository` on the public DataSource; `UsersService`
  exposes `findOnePublic` / `updateSessionPublic` for that path.

Never add a tenant entity to `PUBLIC_ENTITIES` in `src/core.module.ts`. Add it to
`src/modules/tenants/utils/tenant-entities.ts`.

## Auth, JWT, RBAC

- Decorators: `@Public()` skips auth and permission checks; `@Platform()` marks non-tenant routes.
- **JwtGuard**: `@Public` skip; requires `Authorization: Bearer`; verifies the access secret,
  `issuer`, and `audience`; rejects `type !== 'access'`; rejects tenant claims on platform routes
  (403) and missing tenant claims on tenant routes (403); requires the resolved tenant to match the
  token `tenantId` + `tenantSchema` (403); loads the user and its deduplicated direct+role
  permissions.
- **PermissionGuard**: `@Public` skip; `SUPER_ADMIN` bypass; then `@Roles()`; then `@Permissions()`
  where all listed permissions are required.
- JWT claims (`jwt-payload.dto.ts`): `type` (`access` | `refresh`), `id`, `role`, `jti?`,
  `tenantId | null`, `tenantSchema | null`. Access tokens omit `jti`; refresh tokens include it.
  Separate access/refresh secrets and `issuer`/`audience` (Joi requires issuer/audience in
  production). Refresh rotates `jti`, re-checks the tenant registry and status, and rejects a stored
  `user.jti` mismatch with 401.
- `POST /auth/logout` clears the tenant `user.jti`; `POST /auth/logout/platform` clears the public one.
- Roles: `SUPER_ADMIN` (rank 5), `STORE_OWNER` (4), `ADMIN` (3), `CUSTOMER` (0), with rank-based
  guards against privilege escalation in `UsersService`.

## Data model

Public schema:

- `Tenant` (`tenants`): `id`, `name`, unique `slug`/`schemaName`/`subdomain` (subdomain nullable),
  `status` (`active | inactive`), `ownerUserId`, `storageUsedBytes`, `storageCapacityBytes`,
  `stripeAccountId` (unique, nullable), `paymentsPaused`, `payoutsPaused`, `stripePayoutsInterval`,
  `currency` (varchar(3), default `usd`). There are **no** `stripeChargesEnabled` /
  `stripePayoutsEnabled` / `stripeDetailsSubmitted` columns.
- `CurrencyChangeRequest` (`currency_change_requests`): public entity with a partial unique index
  preventing more than one pending request per tenant.
- Subscription entities (all **public**, see `## Subscriptions`): `SubscriptionPlan`
  (`subscription_plans`, unique `slug`), `SubscriptionPlanLimit` / `SubscriptionPlanFeature`
  (`subscription_plan_limits` / `subscription_plan_features`, unique `(planId, key)`, FK cascade),
  `Subscription` (`subscriptions`, numeric `tenantId` unique, `planId` FK `ON DELETE RESTRICT`), and
  `TenantUsageCounter` (`tenant_usage_counters`, unique `(tenantId, metric, periodStart)`).

Tenant schema (`TENANT_ENTITIES`):

- `User` (`user`): unique `email`, `password` (`@Exclude`), nullable `roleId` FK to `Role`
  (`ON DELETE SET NULL`), many-to-many direct permissions via `user_permissions`, `emailVerified`,
  `jti` (`@Exclude`).
- `Role` (`roles`, unique `key`, `isSystem`, M2M `role_permissions`), `Permission`
  (`permissions`, unique `key`).
- `Category` (`categories`): unique `slug`, `description`, `isActive`.
- `Product` (`products`): unique `sku`, unique nullable `slug`, numeric(10,2) `price`, `stock`,
  `isActive`, `categoryId` FK `ON DELETE SET NULL`, images cascade insert.
- `ProductImage` (`product_images`): FK `ON DELETE CASCADE`, unique `objectKey`, `sizeBytes`,
  `mimeType`, `position`.
- `Cart` (`carts`, unique `userId`, FK cascade) and `CartItem` (`cart_items`, unique
  `(cartId, productId)`, FK cascade). Caps: 100 items, quantity 99.
- `Order` (`orders`): unique `orderNumber`, `userId` FK `ON DELETE SET NULL`, `status`,
  `paymentStatus`, numeric(10,2) `subtotal`/`total`/`discountAmount`, coupon snapshot (`couponId` FK
  `ON DELETE SET NULL`, `couponCode`, `couponDiscountType`, `couponDiscountValue`), `paidAt`,
  `refundedAt`, `addressId` FK `ON DELETE SET NULL`, and a full delivery-address snapshot
  (`recipientName`, `phone`, `line1`, `line2`, `city`, `state`, `postalCode`, `country`).
- `OrderItem` (`order_items`): FK `ON DELETE CASCADE`, `productId` FK `ON DELETE SET NULL`, snapshot
  `name`/`sku`/`unitPrice`/`quantity`/`lineTotal`/`imageObjectKey`. Status lifecycle: `PENDING`,
  `CONFIRMED`, `PROCESSING`, `SHIPPED`, `DELIVERED`, `RETURN_REQUESTED`, `RETURNED`, `CANCELLED`.
- `Payment` (`payments`): FK `orderId` `ON DELETE CASCADE`, `provider`, `status`, numeric(10,2)
  `amount`/`refundedAmount`, `currency`, `paymentRef`, `providerReference`, `refundReference`,
  `failureReason`, `paidAt`, `refundedAt`. There is **no** `applicationFeeAmount` column.
- `Address` (`addresses`): FK `userId` cascade, partial unique index ensuring one default per user.
- `Coupon` (`coupons`): unique `code`, `discountType` (`PERCENTAGE | FIXED_AMOUNT`),
  numeric(10,2) `discountValue`/`minOrderAmount`/`maxDiscountAmount`, optional `usageLimit`/
  `perUserLimit`, `usageCount`, optional `startsAt`/`expiresAt`, `isActive`.
- `CouponRedemption` (`coupon_redemptions`): FKs `couponId` and `orderId` cascade, `userId` with no
  FK (history), numeric(10,2) `discountAmount`, unique `(couponId, orderId)`, index
  `(couponId, userId)`.

## Seeding and bootstrap

All seeding is centralized in `src/modules/seeding/`, a registry-driven module. Every seeder is
idempotent and conflict-safe (unique-key upserts plus `withUniqueRetry`), so reruns never duplicate
rows. There is no `seeder_runs` tracking table and no migration: seeders are safe to re-run.

- **Registry.** `SeederRegistry` is fed `PLATFORM_SEEDERS` and `TENANT_SEEDERS` (factory tokens;
  Nest has no native multi-providers). Each seeder declares `name`, `order`, optional `environments`
  and optional `optIn`. Registry validates unique names and sorts by `order` then `name`.
- **Boot.** `SeedingBootstrapService` (`OnApplicationBootstrap`) is the single boot owner. It runs
  the default platform seeders, then the default tenant seeders for every ACTIVE tenant. A platform
  failure (notably a missing bootstrap super admin) throws and the API refuses to boot; per-tenant
  failures are logged and do not fail boot. It returns immediately when `SEED_CLI === 'true'`.
- **Platform seeders** (public schema): `permissions` (upsert all 45 `SEED_PERMISSIONS`), `roles`
  (`SUPER_ADMIN`), `super-admin` (bootstrap user from `BOOTSTRAP_SUPER_ADMIN_*`), `subscription-plans`
  (`free`, `starter`, `growth`, `pro`, `enterprise` from
  `subscriptions/constants/subscription-plan-seeds.ts`), `subscription-backfill` (assign `free` to
  tenants without a subscription and re-sync each tenant's `storageCapacityBytes`).
- **Tenant seeders**: `permissions`, `roles` (`STORE_OWNER`, `ADMIN`, `CUSTOMER`), and the **opt-in**
  `categories` (`BASE_CATEGORIES`, skipped by "run all"). Tenant seeders receive the DataSource
  returned by `TenantManagerService` for the resolved tenant — never the public DataSource.
- `TenantProvisionerService.provision(tenant)`: `CREATE SCHEMA IF NOT EXISTS` → tenant DataSource →
  `seedRbac` for the tenant roles. Provision and boot do **not** create base categories; run
  `seed --tenants --name categories` to opt in. All seeding logic lives under
  `src/modules/seeding/` (`helpers/` for shared upsert helpers, `seeders/` for registered seeders);
  there are no seed services in the feature modules.
- **CLI** (`test/seed.ts`, scripts `seed`, `seed:platform`, `seed:tenants`, `seed:all`): sets
  `SEED_CLI=true` before booting the app context, then drives `SeedingService`. Flags: `--platform`,
  `--tenants`, `--all` (default), `--name <n>` (repeatable/comma), `--tenant <id|slug>`, `--force`.
  A raw schema name is never accepted; tenants resolve only via `TenantService` by id or slug. The
  process exits non-zero on any failure.
- **Production safety.** In `NODE_ENV=production` the CLI refuses to seed unless
  `SEED_ALLOW_PRODUCTION=true` **and** `--force`; `--force` alone never bypasses the env flag.
  Development/test need no `--force`. Boot seeding bypasses this guard (it must always run).

## Storage

- `R2Service` (Cloudflare R2). Object keys are `tenants/{schema}/{folder}/{uuid}.{ext}`; segments are
  sanitized to `[a-z0-9_-]`.
- Product uploads: max 5 files per request, MIME `image/jpeg`, `image/png`, `image/webp` (no GIF),
  `MAX_FILE_SIZE`, and `MAX_PRODUCT_IMAGES` per product. Per-tenant quota is enforced against
  `Tenant.storageCapacityBytes` via `TenantService.adjustStorageUsedBytes` (pessimistic lock, clamps
  at 0, 400 over capacity). `storageCapacityBytes` is plan-driven: it is mirrored from the assigned
  plan's `STORAGE_BYTES` limit on subscription assignment (see `## Subscriptions`). A partial failure
  deletes the uploaded R2 objects and image rows.
- `storageUsedBytes` is maintained incrementally. `TenantService.getSchemaSizes`
  (`pg_total_relation_size`) is surfaced as `schemaSizeBytes` (a plain number) on
  `GET /platform/tenants`, `GET /platform/tenants/:id`, and `GET /dashboard/stats`, alongside a
  display-only `schemaCapacityBytes` from `TENANT_DB_CAPACITY_BYTES` (`TenantService` exposes it via
  `getSchemaCapacityBytes`). A size query failure logs a warning and reports `0`, so the endpoints
  keep rendering. It is display-only: quota enforcement still uses `storageUsedBytes` (R2
  product-image bytes), and the two values measure different things.

## Payments

Payments are **implemented** in `src/modules/payments/` (controller, service,
`stripe.payment.service.ts`, module, entity, DTO, constants). The stale comment in
`payment.entity.ts` calling it a scaffold is out of date.

- Routes: `POST /payments/stripe` (create a PaymentIntent for an order),
  `POST /payments/stripe/webhook` (`@Platform @Public`, raw-body signature verification),
  `GET /payments/stripe/account` (`payments:manage`), `POST /payments/stripe/connect`
  (`payments:manage`).
- Stripe is called directly (no `PaymentProvider` seam, no `PAYMENT_PROVIDER` token, no
  `payments.provider` env). `Stripe` is the only payment provider constant in code.
- Destination charges use `transfer_data.destination` and an optional `application_fee_amount`
  derived from `STRIPE_APPLICATION_FEE_BPS`. `on_behalf_of` is **not** used.
- The PaymentIntent is created before the `Payment` row is persisted, so the "persist first, then
  call Stripe" design in older docs does not apply.
- Webhook handling covers `payment_intent.*`, `charge.refunded`, and `refund.*`; handlers read
  `RawBodyRequest.rawBody`.
- Only `publishableKey` is ever returned; secrets are never serialized or logged.
- Permission keys depend on the shared union: `payments:create|read|manage` (CUSTOMER get
  create+read, ADMIN all three, STORE_OWNER/SUPER_ADMIN inherit all keys).

## Coupons

- `CouponsModule` imports `TenantModule` + `CartModule`, exports `CouponsService`, and is imported by
  `OrdersModule`.
- Routes: `POST /coupons/validate` (`coupons:validate`, preview only, never consumes usage),
  `POST /coupons`, `GET /coupons`, `GET /coupons/:id`, `PATCH /coupons/:id`,
  `PATCH /coupons/:id/status`, `DELETE /coupons/:id`. `DELETE` returns 409 when `usageCount > 0`.
- Codes are trimmed, uppercased, matched against `^[A-Z0-9][A-Z0-9_-]*$`, max 64 chars, unique per
  tenant schema.
- Checkout runs inside the order transaction: `validateAndConsume(manager, ...)` takes a
  `pessimistic_write` lock on the coupon row and re-reads limits after the lock;
  `Order.total = subtotal - discountAmount`; then `consume(manager, ...)` increments `usageCount` and
  inserts the redemption. Inside checkout always use the passed `EntityManager`, never
  `tenantManager.getRepository`, or the lock and writes leave the transaction.
- Full cancel/return calls `restoreUsage` (guarded decrement + redemption delete); partial refunds
  do not. One coupon per order (`CheckoutDto.couponCode`).
- `CouponsService.create` reserves the plan's monthly coupon quota first
  (`COUPON_MONTHLY_LIMIT_REACHED`) and releases it if the insert fails; coupon delete does **not**
  refund quota.

## Subscriptions

SaaS subscription plans are **platform-level** (public schema). Super Admin manages plans and
assigns them; tenants only read their own subscription. Stripe SaaS billing is **deferred**: the
`stripe*` columns exist but are unused, and `src/modules/payments/**` (customer Stripe Connect) is
untouched.

- Entities: `SubscriptionPlan`, `SubscriptionPlanLimit`, `SubscriptionPlanFeature`, `Subscription`
  (one per tenant via unique `tenantId`), `TenantUsageCounter`. All public — never add them to
  `TENANT_ENTITIES`.
- Plan limits: `STORAGE_BYTES`, `DATABASE_BYTES`, `STORE_ADMINS`, `COUPONS_PER_MONTH`, `PRODUCTS`;
  features:
  `STRIPE_PAYMENTS`, `STORE_CUSTOMIZATION`, `COUPONS`, `STAFF_MANAGEMENT`,
  `PRODUCT_IMPORT_EXPORT`, `CUSTOM_DOMAIN`, `ADVANCED_ANALYTICS`, `ADVANCED_REPORTS`, `SEO_TOOLS`,
  `AUDIT_LOGS`, `PRIORITY_SUPPORT`. Unlimited = no limit row or `value IS NULL` (`getLimit` →
  `null`).
- Seeded plans: `free` (500 MB storage / 50 MB DB / 1 admin / 5 coupons / 10 products), `starter`
  (10 GB / 500 MB / 2 admins / 25 coupons / 100 products), `growth` (50 GB / 2 GB / 5 admins /
  100 coupons / 1000 products), `pro` (200 GB / 10 GB / 15 admins / 500 coupons / 5000 products),
  and `enterprise` (no limit rows = unlimited, all features).
- States: active = `ACTIVE`; usable = `TRIALING | ACTIVE | PAST_DUE`, plus `CANCELED` until
  `currentPeriodEnd`. Not usable → `SUBSCRIPTION_INACTIVE`.
- Routes (Super Admin, `@Platform @Roles([SUPER_ADMIN])`): `GET|POST /platform/subscription-plans`,
  `GET|PATCH|DELETE /platform/subscription-plans/:id`,
  `GET /platform/tenants/:id/subscription` (current plan + subscription; falls back to `free`),
  `GET /platform/tenants/:id/subscription/usage` (`{ used, limit, remaining }` per limit key),
  `PUT /platform/tenants/:id/subscription`, `PATCH /platform/tenants/:id/subscription/status`.
  `DELETE` deactivates a plan still referenced by a subscription, otherwise hard-deletes it
  (limits/features cascade).
- Tenant routes (not `@Platform`, gated by `subscriptions:read`): `GET /subscription`,
  `GET /subscription/plans` (active + public), `GET /subscription/usage`. Tenant identity always
  comes from `requireTenantContext()` / `resolveTenantScope()`; a body `tenantId` is rejected by the
  global pipe.
- Enforcement (`SubscriptionEntitlementsService`, the only reader other modules use):
  - **Storage** stays enforced by `TenantService.adjustStorageUsedBytes`; plan assignment mirrors
    `STORAGE_BYTES` into `Tenant.storageCapacityBytes` (unlimited → `Number.MAX_SAFE_INTEGER`).
    Downgrades re-sync the column without throwing; usage is preserved and the new limit applies.
  - **Store admins**: `UsersService.create` wraps `ADMIN`/`STORE_OWNER` creation in
    `SubscriptionService.withTenantLock` and asserts `STORE_ADMINS`. The owner counts; customers and
    platform `SUPER_ADMIN` never do.
  - **Coupons**: `CouponsService.create` asserts the `COUPONS` feature and consumes
    `COUPONS_PER_MONTH` through the atomic `INSERT ... ON CONFLICT ... WHERE used < limit RETURNING`
    counter (calendar month, UTC; delete does not refund).
  - **Database**: `assertCanUseDatabase` runs at order checkout, using
    `pg_total_relation_size` on the resolved tenant schema only (never `public`).
  - **Products**: `ProductsService.create` asserts `PRODUCTS`, the live count of products in the
    tenant schema. `POST /products` carries the HTTP-layer `PRODUCTS` gate; `DATABASE_BYTES` is no
    longer checked at product create (it remains at checkout).
  - **HTTP-layer parity gate**: `SubscriptionGuard` (`subscriptions/guards/`) is a global guard
    registered after `PermissionGuard` so `request.tenant` is populated. It is opt-in via
    `@RequireActiveSubscription()`, `@RequireSubscriptionFeature(...)` and
    `@RequireSubscriptionLimit(...)` (`subscriptions/decorators/`); it skips `@Public`/`@Platform`
    and routes without metadata. It calls `assertUsable`/`assertHasFeature`/`assertLimit`, coexisting
    with the service-level checks (which stay authoritative). `assertLimit` delegates to the existing
    `assertCanUse*`/`assertCanCreate*` methods so error codes are unchanged.
- Domain errors are Nest `HttpException` subclasses with `{ code, message }` bodies (e.g.
  `PLAN_LIMIT_REACHED`, `COUPON_MONTHLY_LIMIT_REACHED`, `STORE_ADMIN_LIMIT_REACHED`,
  `DATABASE_LIMIT_REACHED`, `PRODUCT_LIMIT_REACHED`, `SUBSCRIPTION_INACTIVE`). No global exception
  filter is added.
- Permissions: `subscriptions:read` (STORE_OWNER + ADMIN) and `subscriptions:manage`
  (STORE_OWNER; enforced by the platform `SUPER_ADMIN` role on platform routes). Registered in
  `PermissionKey`, `SEED_PERMISSIONS`, and `SEED_ROLE_PERMISSIONS`.
- The DB gate runs only at checkout; product create is gated by the `PRODUCTS` count limit, and
  other writes are not gated (known limitation). Public-schema subscription tables are created by
  `synchronize`, not migrations.

## Storefront and catalog endpoints

- `GET /store/info` is `@Public` and returns `{ name, slug, currency }` for the resolved tenant.
- Product reads are `@Public`: `GET /products` and `GET /products/:id`. Because `@Public` short-
  circuits `PermissionGuard`, the `products:read` decorators on those GETs are inert.
- Category reads (`GET /categories`) are **not** public and require a permission.
- Other public routes: `POST /auth/register`, `POST /auth/login`, `POST /auth/login/platform`,
  `POST /auth/refresh`, `GET /health` (`@Public @Platform`, reports DB + R2).

## Environment

`.env.example` is the source of truth; `src/common/config/env.schema.ts` (Joi) validates at boot.
Secret rules (≥32 chars, no placeholders) and required `JWT_ISSUER`/`JWT_AUDIENCE` apply only when
`NODE_ENV=production`. Stripe keys are required, so a `.env` copied from `.env.example` with blank
Stripe values fails to boot.

Groups in `IENV` (`env.interface.ts`): `app` (`APP_*`, `BOOTSTRAP_SUPER_ADMIN_*`,
`APP_ROOT_DOMAIN`), `db` (`DB_*`, `DB_SYNCHRONIZE_TENANTS`, `TENANT_POOL_SIZE`,
`TENANT_STORAGE_CAPACITY_BYTES`, `TENANT_DB_CAPACITY_BYTES`), `jwt`, `bcrypt`, `log`,
`throttling` (`THROTTLE_TTL`,
`THROTTLE_LIMIT`), `cors`, `r2`, `files` (`MAX_FILE_SIZE`, `MAX_PRODUCT_IMAGES`), `stripe`
(`STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`,
`STRIPE_APPLICATION_FEE_BPS`, optional `STRIPE_ONBOARDING_RETURN_URL`,
`STRIPE_ONBOARDING_REFRESH_URL`), `seeding` (`SEED_ALLOW_PRODUCTION`). There is **no** `payments`
group, `PAYMENT_PROVIDER`, `STRIPE_CURRENCY`, or `STRIPE_CONNECT_COUNTRY`.

Access config through `ConfigService<IENV>` typed groups and `getOrThrow<IX>('group')`.

## Tests

- Unit specs use the inline Jest config in `package.json` (`rootDir: src`,
  `testRegex .*\.spec\.ts$`, `ts-jest`). There are ~58 spec files.
- E2E: `test/jest-e2e.json` with `test/app.e2e-spec.ts` (login/platform empty body → 400;
  `users/profile` without tenant headers → 400).
- `test/verify-*.ts` and `test/reset-dev-db.ts` boot the app against a live database; they are manual.

## Conventions and quirks

- Validate DTOs with class-validator; the global pipe rejects unknown body fields.
- Use `TenantManagerService.getRepository(entity, tenant)` for tenant data and `@InjectRepository`
  (public DataSource) for public data.
- `DB_SYNCHRONIZE_TENANTS` (default `false`) is the production opt-in for tenant `synchronize` until
  a migrations system exists. Tenant schemas are created from entity metadata, not migrations.
- `src/...` imports resolve through `tsconfig.json` `baseUrl` (no `paths`) and Jest's
  `moduleNameMapper`. `strict` is off; `strictNullChecks` on, `noImplicitAny` off.
- ESLint is flat config (`eslint.config.mjs`) with prettier; `lint` auto-fixes, so it mutates files.
- Quirks to be aware of when editing: `PaymentsModule` provides its **own** `TenantManagerService`
  instance (a second DataSource cache, not `TenantModule`'s); `R2Module` lists `TenantModule` as a
  provider rather than importing it; `PaymentsService` writes `canceledAt`/`failedAt` properties that
  are not entity columns (silent no-ops).
- `docs/` does **not** exist in this app; ignore any reference to planning artifacts under it.
