# AGENTS.md — apps/api (`saas_store_api`)

Schema-per-tenant multi-tenant commerce API. NestJS 10 + TypeORM 0.3 + PostgreSQL 16.
Package manager: pnpm (single workspace; run installs from the repository root).

This file is the authoritative architecture reference for the API. The root `AGENTS.md` covers
cross-app contracts; the frontends' own `AGENTS.md` files describe their clients.

## Commands

Run from the repository root with a filter, or from `apps/api` directly.

- `pnpm --filter saas_store_api dev` — watch mode (`nest start --watch`; alias `start:dev`).
  Needs Postgres and Redis from the root `compose.yaml`
  (`docker compose up -d postgres redis`) and a real `apps/api/.env`.
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
  `ValidationPipe({ whitelist, forbidNonWhitelisted, transform })`; global interceptors in this
  exact order: **`ResponseCacheInterceptor` → `ClassSerializerInterceptor`** (strips `@Exclude`);
  `listen(APP_PORT)`. There is no global exception filter.
- `src/app.module.ts` — imports all feature modules and registers six global guards in this exact
  order: **TenantGuard → JwtGuard → EmailVerifiedGuard → PermissionGuard → SubscriptionGuard →
  ThrottlerGuard**. `TenantMiddleware` is applied to `*`.
- `src/core.module.ts` — global `ConfigModule` (Joi `EnvSchema`, typed env load), global
  `JwtModule` (access secret/expiry), `ThrottlerModule`, `CacheModule`, pino logger, R2 module,
  and the public-schema TypeORM DataSource.
  `PUBLIC_ENTITIES = [Tenant, User, Role, Permission, CurrencyChangeRequest, SubscriptionPlan,
  SubscriptionPlanLimit, SubscriptionPlanFeature, Subscription, SubscriptionPayment,
  TenantUsageCounter]`.
- `src/common/` — `config/` (env schema, typed groups, `cors.util.ts`, `data-source.factory.ts`),
  `logger/` (pino to rotating file, TypeORM daily logger), `storage/` (`R2Service` on
  `@aws-sdk/client-s3`), `health/` (`GET health`), `cache/`, `http/` (route templates),
  `db/` (`money-column`, `unique-retry`), `constants/` (`RoleKey` + `ROLE_RANK`, `PermissionKey`
  union, `currency.enum`).
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
  permissions, and sets `request.user.emailVerified`.
- **EmailVerifiedGuard**: requires a verified email on **every** authenticated tenant route. It
  runs after `JwtGuard` and skips `@Public` and `@Platform`. An unverified user is rejected with
  `403 { code: 'EMAIL_NOT_VERIFIED' }`. A route or controller opts out with
  `@AllowUnverifiedEmail()` — used only for recovery paths (`POST /auth/logout`). Unverified users
  verify via the `@Public` `POST /auth/email-otp/verify` route.
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

## Email OTP

- `src/modules/email-otp/` owns generation, storage, throttling counters and atomic consumption
  (`EmailOtpService`); `src/modules/email/` is the delivery seam (`EmailService` over an
  `EMAIL_TRANSPORT` factory: `smtp` via `nodemailer`, `log` for dev, `memory` for tests). Provider is
  selected by `EMAIL_PROVIDER`; the `log` transport never writes the code.
- `OtpChallenge` (`otp_challenges`) is a **tenant** entity (add to `TENANT_ENTITIES`, never
  `PUBLIC_ENTITIES`). At most one active row per `(userId, purpose)` via a partial unique index
  (`WHERE "consumedAt" IS NULL`). `codeHash = hex(HMAC-SHA256(OTP_HASH_SECRET, "<id>:<code>"))`,
  compared with `timingSafeEqual`; the challenge id is generated in-app so it can be part of the
  HMAC. Resend replaces the prior challenge; verify locks the latest row (`pessimistic_write`) and
  consumes it exactly once.
- Routes (all `@Public()`, tenant-scoped — clients must send `x-tenant-slug`/`x-tenant-id` or use
  the tenant subdomain): `POST /auth/email-otp/request` (generic `200` even for unknown emails),
  `POST /auth/email-otp/verify`, `POST /auth/password-reset/confirm`. `POST /auth/register` also
  dispatches an `EMAIL_VERIFICATION` OTP. Errors use `{ code, message }`: `OTP_INVALID`,
  `OTP_EXPIRED`, `OTP_ALREADY_USED`, `OTP_TOO_MANY_ATTEMPTS`, `OTP_PURPOSE_REQUIRES_CONFIRM`.
- Platform (`SUPER_ADMIN`) OTP is out of scope; this is tenant-schema only. Production schema
  changes use the idempotent `test/migrate-otp-challenges.ts`; dev/staging rely on `synchronize`.

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
  `Subscription` (`subscriptions`, numeric `tenantId` unique, `planId` FK `ON DELETE RESTRICT`),
  `SubscriptionPayment` (`subscription_payments`, FK `subscriptionId` `ON DELETE CASCADE`, non-FK
  `planId`/`billingInterval` snapshot; a public ledger mirroring tenant `Payment`), and
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
  `POST /payments/stripe/subscription` (create a PaymentIntent for a subscription plan; returns
  `{ clientSecret }`), `POST /payments/stripe/subscription/cancel` (tenant self-serve cancel + full
  refund, `subscriptions:manage`, see `## Subscriptions`), `POST /payments/stripe/webhook`
  (`@Platform @Public`, raw-body signature verification), `GET /payments/stripe/account`
  (`payments:manage`), `POST /payments/stripe/connect` (`payments:manage`). `PaymentsModule` also
  hosts the platform `POST /platform/tenants/:id/subscription/cancel` (SUPER_ADMIN): it refunds the
  tenant's latest paid `SubscriptionPayment` on the platform account and falls back to the free plan.
- Stripe is called directly (no `PaymentProvider` seam, no `PAYMENT_PROVIDER` token, no
  `payments.provider` env). `Stripe` is the only payment provider constant in code.
- Destination charges use `transfer_data.destination` and an optional `application_fee_amount`
  derived from `STRIPE_APPLICATION_FEE_BPS`. `on_behalf_of` is **not** used.
- The PaymentIntent is created before the `Payment` row is persisted, so the "persist first, then
  call Stripe" design in older docs does not apply.
- `POST /payments/stripe/subscription` charges the **platform** Stripe account (no `transfer_data`,
  no `application_fee_amount`, no Connect account required, no `paymentsPaused` check) because plan
  revenue is platform revenue. It is gated by `subscriptions:manage` (STORE_OWNER only; ADMIN has
  `subscriptions:read` only, SUPER_ADMIN bypasses), requires a tenant `Subscription` row, and
  persists a `SubscriptionPayment` (`status = PENDING`, `paymentRef = intent.id`).
- `POST /payments/stripe/subscription/cancel` (`subscriptions:manage`, tenant-scoped) is the
  self-serve counterpart: it refunds the tenant's latest **PAID** `SubscriptionPayment` on the
  platform account (shared private helper, idempotency key `refund-subscription-{paymentId}`), then
  downgrades to the free plan. It is allowed only within
  `SUBSCRIPTION_REFUND_WINDOW_DAYS` (7) days of that payment's `paidAt` (fallback `createdAt`).
  Errors use `{ code, message }`: `404 SUBSCRIPTION_NOT_FOUND`, `409 SUBSCRIPTION_NOT_REFUNDABLE`
  (no paid purchase), `409 REFUND_WINDOW_EXPIRED`. An already-refunded repeat is a `200` no-op
  (idempotent with the `charge.refunded` webhook path below).
- Webhook handling covers `payment_intent.*`, `charge.refunded`, and `refund.*`. `webHook` verifies
  the raw-body signature (handlers read `RawBodyRequest.rawBody`), then classifies each event by
  parsing `metadata.data.kind` and dispatches to one of two handlers:
  - `handleOrderPaymentEvents` — order intents (metadata has no `kind`); updates the tenant
    `Payment`/`Order` exactly as before (byte-identical path).
  - `handleSubscriptionEvents` — subscription intents (`kind === 'subscription'`);
    `succeeded` marks the public `SubscriptionPayment` row `PAID` and calls
    `SubscriptionService.assignPlan` (sets the plan `ACTIVE`/`TRIALING`, the period, and mirrors
    storage capacity); `canceled` → ledger `CANCELED`, `payment_failed` → `FAILED` + `failureReason`,
    refunds reconcile the ledger (`REFUNDED`/`PARTIALLY_REFUNDED`/`PAID`), and a **fully** refunded
    payment falls back to the free plan via `SubscriptionService.downgradeToFree` (partial refunds
    and reversals keep the paid plan; idempotent on webhook retries).
  - Refund-family events carry no metadata; the intent is fetched once with `latest_charge`, then
    classified and routed (cumulative `charge.amount_refunded` keeps partial/repeated refunds
    idempotent). `successSubscriptionPayment` early-returns when the ledger row is already `PAID`, so
    Stripe redeliveries do not reset the subscription period.
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

SaaS subscription plans are **platform-level** (public schema). Super Admin manages plans and assigns
them; tenants read their own subscription. There is **no** recurring Stripe Billing flow:
`StripeBillingService`, checkout endpoints, billing webhooks, and the `Subscription` Stripe columns
were removed. A one-off platform-account PaymentIntent purchase endpoint
(`POST /payments/stripe/subscription`, see `## Payments`) creates a `PENDING` ledger row, and the
`payment_intent.succeeded` webhook for a `kind === 'subscription'` intent assigns the plan on success
(self-serve completion). `src/modules/payments/**` otherwise remains the separate customer Stripe
Connect destination-charge flow.

- Entities: `SubscriptionPlan`, `SubscriptionPlanLimit`, `SubscriptionPlanFeature`, `Subscription`
  (one per tenant via unique `tenantId`), `SubscriptionPayment` (`subscription_payments`, the public
  plan-payment ledger; written as `PENDING` by `POST /payments/stripe/subscription`, then reconciled
  by the subscription webhook handler — `PAID`/`CANCELED`/`FAILED`/`REFUNDED`/`PARTIALLY_REFUNDED`),
  `TenantUsageCounter`. All public — never
  add them to `TENANT_ENTITIES`.
- Plan limits: `STORAGE_BYTES`, `DATABASE_BYTES`, `STORE_ADMINS`, `COUPONS_PER_MONTH`, `PRODUCTS`;
  features:
  `STRIPE_PAYMENTS`, `STORE_CUSTOMIZATION`, `COUPONS`, `STAFF_MANAGEMENT`,
  `PRODUCT_IMPORT_EXPORT`, `CUSTOM_DOMAIN`, `ADVANCED_ANALYTICS`, `ADVANCED_REPORTS`, `SEO_TOOLS`,
  `AUDIT_LOGS`, `PRIORITY_SUPPORT`. Unlimited = no limit row or `value IS NULL` (`getLimit` →
  `null`).
- Seeded plans: `free` (500 MB storage / 50 MB DB / 1 admin / 5 coupons / 10 products, $0), `starter`
  (10 GB / 500 MB / 2 admins / 25 coupons / 100 products, $29/$290), `growth` (50 GB / 2 GB / 5
  admins / 100 coupons / 1000 products, $99/$990), `pro` (200 GB / 10 GB / 15 admins / 500 coupons /
  5000 products, $299/$2990), and `enterprise` (no limit rows = unlimited, all features,
  $999/$9990). All seed prices are `usd` and are re-synced by the idempotent `subscription-plans`
  seeder, so re-running the seed backfills prices on an existing database.
- States: active = `ACTIVE`; usable = `TRIALING | ACTIVE | PAST_DUE`, plus `CANCELED` until
  `currentPeriodEnd`. Not usable → `SUBSCRIPTION_INACTIVE`.
- Routes (Super Admin, `@Platform @Roles([SUPER_ADMIN])`): `GET|POST /platform/subscription-plans`,
  `GET|PATCH|DELETE /platform/subscription-plans/:id`,
  `GET /platform/tenants/:id/subscription` (current plan + subscription; falls back to `free`),
  `GET /platform/tenants/:id/subscription/usage` (`{ used, limit, remaining }` per limit key),
  `PUT /platform/tenants/:id/subscription`, `PATCH /platform/tenants/:id/subscription/status`,
  `POST /platform/tenants/:id/subscription/cancel` (cancel + refund the latest paid plan purchase,
  then fall back to `free`; implemented in `PaymentsModule` — the refund needs Stripe and the free
  fallback needs `SubscriptionService`, and `SubscriptionsModule` cannot import `PaymentsModule`
  without a cycle). `DELETE` deactivates a plan still referenced by a subscription, otherwise
  hard-deletes it (limits/features cascade).
- Tenant routes (not `@Platform`): reads gated by `subscriptions:read` — `GET /subscription`,
  `GET /subscription/plans` (active + public), `GET /subscription/usage`. `GET /subscription` is
  additive: it merges a read-time refund snapshot (`refundEligible: boolean`,
  `refundDeadline: string | null` — ISO, `null` when no subscription or no PAID purchase) computed
  by `SubscriptionService.getRefundInfo` from the latest PAID `SubscriptionPayment` (the deadline is
  `paidAt` + `SUBSCRIPTION_REFUND_WINDOW_DAYS`, fallback `createdAt`). The flag is **advisory**; the
  cancel route re-checks authoritatively. A plan purchase starts a PaymentIntent via
  `POST /payments/stripe/subscription`, and the plan is then assigned **only** when the Stripe
  `payment_intent.succeeded` webhook reconciles it. Self-serve cancel + refund is the one tenant
  mutation: `POST /payments/stripe/subscription/cancel` (`subscriptions:manage`, implemented in
  `PaymentsModule` for the same cycle reason as the platform route). Resume/re-subscribe is still out
  of scope; tenant identity always comes from `requireTenantContext()` / `resolveTenantScope()`; a
  body `tenantId` is rejected by the global pipe.
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
- Permissions: `subscriptions:read` (STORE_OWNER + ADMIN) gates the tenant reads. `subscriptions:manage`
  gates the tenant purchase + cancel/refund routes (`POST /payments/stripe/subscription[/cancel]`;
  STORE_OWNER only, ADMIN has read only, SUPER_ADMIN bypasses).
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

## Caching

Server-side, opt-in caching backed by Redis (the only cache store); no browser cache, queue, or
background worker. `REDIS_URL` is required at boot. The existing global `ThrottlerGuard` remains
unchanged and applies to every request, including cache hits.

- `src/common/cache/` — `redis-cache.store.ts` implements `CacheStore` over ioredis with a namespace
  key set (`ns:<namespace>`), a namespace version (`nsv:<namespace>`), and a Lua write guard.
  `TenantCacheService` builds keys
  (`api:v1:cache:tenant:<schema>:<namespace>:<sha256>` / `…:platform:…`), single-flights loads,
  handles invalidation races with identity tokens, and fails open on store errors. `CacheModule` is
  `@Global`, always constructs `RedisCacheStore`, and lives in `CoreModule`.
- Redis invalidation is cross-instance: `invalidateNamespace` increments the namespace version,
  deletes the keys in the namespace index, and publishes `cache:invalidate`; every replica marks
  its local in-flight loads stale. A write whose captured version no longer matches is rejected and
  retried once. Invalidation never uses `KEYS`/`SCAN`.
- `CACHE_MAX_ENTRY_BYTES` is enforced by the store. Bound Redis with `maxmemory` +
  `maxmemory-policy allkeys-lru`. Redis `entries`/`bytes`/`evictions` in health come from
  `DBSIZE`/`INFO` and are Redis-wide, not cache-only. Under memory pressure, eviction of a namespace
  index or version key weakens invalidation to the entry TTL, so size `maxmemory` above the working
  set.
- The only cacheable routes are `GET /products`, `GET /products/:id`, `GET /categories`,
  `GET /categories/:id`, `GET /subscription/plans`, and `GET /platform/subscription-plans`.
  `@CacheResponse({ policy, scope })` on any other route is ignored with a warning. Plans use the
  shared `platform:subscription-plans` namespace so both read routes clear together.
- Invalidation is post-write only: product writes/images, category writes (categories + products),
  checkout, order cancel, `ManageOrderService.updateStatus` for `CANCELLED`/`RETURNED`, and plan
  writes. `requestReturn` does not touch stock and does not invalidate. Invalidation errors are
  logged and never fail the mutation.
- `ResponseCacheInterceptor` forces `Cache-Control: private, no-store` on tenant/private responses,
  `public, no-store` on the public plan catalog, and `private, no-store` on errors/non-cacheable
  routes; it also emits `X-Cache: HIT|MISS|BYPASS` and tenant `Vary`. The cache stores the
  post-serialization handler result, so `@Exclude` fields are never cached.
- `DB_STATEMENT_TIMEOUT_MS` (default 30000, `0` disables) is passed to both DataSources as
  `extra.statement_timeout`. It is a per-statement PostgreSQL timeout, not a request deadline.
- `GET /health` adds `cache: { driver, status, entries, bytes, hits, misses, errors }`; cache
  status does not change the top-level `status` (still DB + R2).

## Environment

`.env.example` is the source of truth; `src/common/config/env.schema.ts` (Joi) validates at boot.
Secret rules (≥32 chars, no placeholders) and required `JWT_ISSUER`/`JWT_AUDIENCE` apply only when
`NODE_ENV=production`. Stripe keys are required, so a `.env` copied from `.env.example` with blank
Stripe values fails to boot.

Groups in `IENV` (`env.interface.ts`): `app` (`APP_*`, `BOOTSTRAP_SUPER_ADMIN_*`,
`APP_ROOT_DOMAIN`), `db` (`DB_*`, `DB_SYNCHRONIZE_TENANTS`, `DB_STATEMENT_TIMEOUT_MS`,
`TENANT_POOL_SIZE`, `TENANT_STORAGE_CAPACITY_BYTES`, `TENANT_DB_CAPACITY_BYTES`), `jwt`, `bcrypt`,
`log`, `throttling` (`THROTTLE_TTL`, `THROTTLE_LIMIT`), `cors`, `r2`, `files` (`MAX_FILE_SIZE`,
`MAX_PRODUCT_IMAGES`), `stripe` (`STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`,
`STRIPE_WEBHOOK_SECRET`, `STRIPE_APPLICATION_FEE_BPS`, optional
`STRIPE_ONBOARDING_RETURN_URL`, `STRIPE_ONBOARDING_REFRESH_URL`), `seeding`
(`SEED_ALLOW_PRODUCTION`), `otp` (`OTP_LENGTH`, `OTP_EXPIRATION_SECONDS`, `OTP_MAX_ATTEMPTS`,
`OTP_RESEND_COOLDOWN_SECONDS`, `OTP_MAX_REQUESTS`, `OTP_REQUEST_WINDOW_SECONDS`, `OTP_HASH_SECRET`,
`OTP_REQUIRE_EMAIL_VERIFIED`), `email` (`EMAIL_PROVIDER` = `smtp|log|memory`, `EMAIL_FROM_ADDRESS`,
`EMAIL_FROM_NAME`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_SECURE`), `cache`
(`CACHE_ENABLED`, `CACHE_MAX_ENTRY_BYTES`, `CACHE_MAX_INFLIGHT`, `CACHE_OPERATION_TIMEOUT_MS`,
`CACHE_*_TTL_SECONDS`, required `REDIS_URL`, `CACHE_REDIS_TLS`, `CACHE_REDIS_CONNECT_TIMEOUT_MS`,
`CACHE_REDIS_COMMAND_TIMEOUT_MS`, `CACHE_REDIS_SAFETY_TTL_SECONDS`).
There is **no** `payments` group, `PAYMENT_PROVIDER`, `STRIPE_CURRENCY`, or
`STRIPE_CONNECT_COUNTRY`.

`OTP_HASH_SECRET` and `EMAIL_FROM_ADDRESS` are required (like the JWT/R2 secrets), so an `.env`
copied before the OTP feature fails to boot until they are added (see `.env.example`); with
`EMAIL_PROVIDER=smtp` (the default) `SMTP_HOST`/`SMTP_PORT` are required too, so set
`EMAIL_PROVIDER=log` for local dev.

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
