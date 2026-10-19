# Progress — saas_commerce

What works, what is left, and known issues. Update when work completes or debt is found.

## What works

- **API** (`saas_store_api`): schema-per-tenant isolation, tenant resolution + guards, JWT auth
  with rotation, RBAC (45 seeded permissions), products/categories/cart/orders/addresses/coupons,
  implemented Stripe payments (PaymentIntent, webhook, Connect), R2 storage with quotas, platform
  endpoints, dashboard endpoints, currency requests, and SaaS subscription plans (limits/features,
  Super-Admin assignment + platform reads for a tenant's subscription and usage, tenant read-only
  APIs, enforcement in user/coupon/product/order flows, plus an opt-in HTTP-layer
  `SubscriptionGuard` on annotated routes). Tenant subscription routes are **read-only**; plans are
  assigned by Super Admin. Recurring self-serve subscription billing was removed (2026-10-09): no
  `StripeBillingService`, no checkout/cancel/resume routes, no billing webhook handling, and no
  `stripe*` columns on `Subscription`. A one-off purchase flow was re-added the same day:
  `POST /payments/stripe/subscription` (`subscriptions:manage`, STORE_OWNER only) creates a
  platform-account Stripe PaymentIntent for a public/active plan and writes a `PENDING`
  `SubscriptionPayment`; the webhook split then assigns the plan on `payment_intent.succeeded`
  (`kind === 'subscription'` → `handleSubscriptionEvents` → ledger `PAID` +
  `SubscriptionService.assignPlan`), with `CANCELED`/`FAILED` ledger transitions and a full refund
  falling back to the free plan. Super Admin can also `POST /platform/tenants/:id/subscription/cancel`
  to cancel and refund the latest paid purchase in one call (implemented in `PaymentsModule`). Tenants
  have a self-serve counterpart — `POST /payments/stripe/subscription/cancel` (`subscriptions:manage`)
  refunds the latest PAID purchase within a 7-day window (`SUBSCRIPTION_REFUND_WINDOW_DAYS`, from
  `paidAt`/`createdAt`) and downgrades to free; `GET /subscription` reports additive
  `refundEligible`/`refundDeadline`. Seeded plans carry `monthlyPrice`/`yearlyPrice`/`currency`.
  ~79 unit spec files.
- **Email OTP** (`apps/api/src/modules/email-otp/` + `src/modules/email/`): tenant-scoped OTP with
  an `otp_challenges` tenant entity, HMAC-SHA256 code hashing, resend cooldown/per-window cap/
  attempt limits, pessimistic-lock consume, and an `EMAIL_TRANSPORT` seam (`nodemailer` SMTP / log /
  memory; new `nodemailer` dependency). Routes `POST /auth/email-otp/{request,verify}` and
  `POST /auth/password-reset/confirm`; register dispatches `EMAIL_VERIFICATION`; login can be gated
  by `OTP_REQUIRE_EMAIL_VERIFIED`. Platform OTP and login MFA are deferred. Global
  `EmailVerifiedGuard` requires a verified email on all authenticated tenant routes (`403
  EMAIL_NOT_VERIFIED`); `@AllowUnverifiedEmail()` opts out (logout).
- **API caching** (`apps/api/src/common/cache`): a Redis-backed cache on six reads
  (`GET /products`, `/products/:id`, `/categories`, `/categories/:id`, `/subscription/plans`,
  `/platform/subscription-plans`) with post-write invalidation, forced `Cache-Control: no-store`,
  `X-Cache`, and a single-flight namespace store. Redis is the only driver (`REDIS_URL` required):
  namespace key sets, namespace versions, and cross-instance invalidation via pub/sub.
  `DB_STATEMENT_TIMEOUT_MS` bounds each PostgreSQL statement, and `GET /health` reports cache stats.
  The endpoint-priority admission-control experiment was removed; the stock `ThrottlerGuard` is
  back.
- **Seeding module** (`apps/api/src/modules/seeding/`): registry-driven platform + tenant seeders
  (permissions, roles, super-admin, subscription-plans, subscription-backfill; opt-in categories),
  a single `SeedingBootstrapService` boot owner, and the `test/seed.ts` CLI
  (`seed`/`seed:platform`/`seed:tenants`/`seed:all`, `--name`, `--tenant`, `--force`). Idempotent,
  conflict-safe upserts; production seeding requires `SEED_ALLOW_PRODUCTION=true` + `--force`.
  Legacy seed services (`RbacSeedService`, `SubscriptionSeedService`, `TenantReseedService`,
  `categories.seed.ts`) were removed.
- **Tenant schema size** (`getSchemaSizes` → `pg_total_relation_size`) is wired as `schemaSizeBytes`
  into `GET platform/tenants`, `GET platform/tenants/:id`, and `GET dashboard/stats`, with a
  display-only `schemaCapacityBytes` from `TENANT_DB_CAPACITY_BYTES`, and rendered in the
  super-admin tenant list/show and the store-owner StorageCard. Display-only; size failures report
  `0`.
- **Store owner dashboard** (`tenant_dash`): auth + single-flight refresh, tenant-scoped lists and
  forms for products/categories/orders/users, payments and store settings, plus public
  `/verify-email`, `/forgot-password`, `/reset-password` pages backed by `otp.api.ts`. The
  `/settings/subscription` page shows the current plan (status/billing/price/period/trial) and live
  usage against `subscription`, `subscription/plans`, `subscription/usage` plus an "Available plans"
  shadcn `Tabs` section with a Monthly/Yearly toggle. Self-serve checkout is restored (2026-10-09):
  each non-current billable tab has an **Upgrade** button opening a Stripe Elements
  `PlanCheckoutDialog` (`src/lib/stripe.ts` + `@stripe/*` deps, build-time
  `VITE_STRIPE_PUBLISHABLE_KEY`) that creates a `POST payments/stripe/subscription` intent, confirms
  the card, and polls `GET subscription` until the webhook assigns the plan. Self-serve **cancel +
  refund** is now built (2026-10-09): a destructive button + `CancelSubscriptionDialog` on the
  current-plan card when `subscription.refundEligible`, posting `payments/stripe/subscription/cancel`
  and `refetchAll()` on success (Resume remains unbuilt). `subscriptions.api.ts` gained
  `createPaymentIntent` (in-flight dedupe) and `cancelSubscription`.
  An unverified login redirects to `/verify-email` without storing a session. Tenant resolution has
  an optional apex `?tenant=<slug>` fallback when the build-time `VITE_ALLOW_SUBDOMAIN=false`
  (browser resolve in `src/api/tenant.ts`; `apiClient` attaches `x-tenant-slug`; `TenantParamSync`
  re-appends the param after Refine navigation). Fourteen Vitest files (169 tests).
  A 2026-10-09 review-fix pass (plan `.kilo/plans/1791552085658-tenant-dashboard-review-fix-plan.md`)
  added: full-reload cache reset on logout / tenant switch (`src/lib/client-reset.ts`,
  `src/lib/tenant-sync.ts`), tenant-aware forced-401 redirect, `canManageCatalog` role gates on
  catalog create/row actions, explicit-`null` clearing for product category and coupon optionals,
  `PENDING`/`CANCELED` payment statuses, list/detail error+retry states (`QueryErrorState`), a
  route-level error boundary, confirmation dialogs for destructive actions, `nextStatuses`-gated
  order-status options, accessibility labels, and `import.meta.env.DEV` gating of
   Refine Devtools (removed from the production bundle). Low findings are deferred to the plan's
   backlog. (That pass also hardened an older subscription checkout; it was removed and then
   freshly re-added as the 2026-10-09 self-serve checkout described above.)
- **Super admin dashboard** (`super_admin_dash`): tenant provisioning/lifecycle, platform payments
  oversight, currency request approve/reject, and subscription plan CRUD (list/create/edit/delete)
  plus a per-tenant subscription panel (current plan/status/period, live usage, change plan +
  interval, cancel/reactivate) backed by the platform subscription reads.
- **Storefront** (`tenant_store`): host-decided platform vs tenant contexts (`classifyHost` in
  `src/lib/tenant/host.ts`), with an optional apex `?tenant=<slug>` fallback when the build-time
  `NEXT_PUBLIC_ALLOW_SUBDOMAIN=false` (proxy `resolveTenantSlug`; a trusted `x-tenant-slug` request
  header is injected and client navigation keeps the param), two route groups with two root
  layouts, platform landing/plans/register-store on the apex (`/` rewritten to `/home`) and the
  subdomain storefront for tenants, NextAuth credentials login with the refresh token kept
  server-side only, tenant-keyed store-info cache, catalog by numeric id, cart, checkout, Stripe
  payment step, order history/cancel/return, refresh proxy, route `loading`/`error` boundaries,
  product `notFound()` + `generateMetadata`, and a hard 404 for unknown store subdomains. See
  `activeContext.md` for the host-routing change and the earlier architecture-review remediation
  (P0-1/P0-2, P1-3/P1-4/P1-5, P2-3..P2-6, P2-9, P3-3..P3-6). Catalog caching (P1-1/P1-2),
  server-side search (P2-1), `PlaceOrder` split (P2-2), full SEO (P2-7) and shared API types (P2-8)
  remain.
- **Storefront email OTP** (`apps/tenant_store`): `otpApi.ts` plus public `/verify-email`,
  `/forgot-password`, `/reset-password` pages (shadcn `input-otp` code entry). Register routes to
  verify; any `EMAIL_NOT_VERIFIED` (login, proxy before render for protected paths, or the apiClient
  interceptor) redirects to `/verify-email`, which reads the email from the session.

## What is left / not wired

- No migrations system; tenant schemas rely on entity metadata + `DB_SYNCHRONIZE_TENANTS`. The
  public-schema subscription tables are also created by `synchronize`, not migrations.
- Stripe SaaS billing **phase 2** is not wired: no plan switching/proration, no Billing Portal,
  no stored Stripe Price ids on `SubscriptionPlan`, and no webhook event-dedupe table (idempotent
  upserts only). Already-billed tenants are blocked from a new checkout intent. Super Admin can
  still assign plans directly.
- The public `SubscriptionPayment` entity (`subscription_payments`) now has an end-to-end flow:
  `POST /payments/stripe/subscription` writes a `PENDING` row, and the Stripe webhook reconciles it
  via the two-handler split (`handleOrderPaymentEvents` / `handleSubscriptionEvents`, classified on
  `metadata.data.kind`). Subscription `succeeded` assigns the plan (`assignPlan`, idempotent when
  already `PAID`), `canceled`/`payment_failed` update the ledger, and a **fully refunded** payment
  falls back to the free plan (`SubscriptionService.downgradeToFree`; partial refunds keep the paid
  plan). A `PLAN_INACTIVE`/missing-row error on `succeeded` still returns non-2xx, so Stripe
  retries until resolved. Table is created by `synchronize` on boot.
- Subscription database-size gate runs `pg_total_relation_size` only at checkout; product create is
  gated by a live `PRODUCTS` count (free 10 / starter 100 / growth 1000 / pro 5000 / enterprise
  unlimited). The HTTP-layer `SubscriptionGuard` is parity-only and runs the same checks as the
  service; `STORE_ADMINS`/`STORAGE_BYTES` stay service-only because they have no annotatable tenant
  route (store-admin creation is on the `@Public @Platform` register route).
- Base product categories are created only by the **opt-in** tenant seeder
  (`seed --tenants --name categories`); provisioning, reseeding, and boot never create them. The old
  dead `categories.seed.ts` was deleted as part of the seeding-module consolidation.
- Store owner: cart `UpdateCartItem`/`ClearCart` equivalents and some endpoints exist but are not
  wired to UI on the storefront (see `apps/tenant_store` cart endpoints).
- Super admin: `authProvider.getIdentity` returns `{ id, name, roles }` but `UserAvatar`/`UserInfo`
  expect `{ firstName, lastName, fullName, ... }`, so avatar initials/identity text render blank.
- Super admin unused boilerplate: `@refinedev/rest`, `@refinedev/simple-rest`,
  `@refinedev/react-hook-form`, `sign-up-form.tsx`, `forgot-password-form.tsx`, `edit-view.tsx`.

## Known issues / tech debt

- **Kilo CLI frontmatter (tooling, not app code):** `@kilocode/cli` 7.8.3 reports
  `Failed to parse frontmatter: No context found for instance` for every `.kilo/command/*.md` and
  `.kilo/agent/*.md`. A minimal one-line frontmatter and even a file with no frontmatter both fail,
  so the defect is in the compiled CLI engine, not the files. Commands may load without metadata
  until the CLI is updated.
- `PaymentsModule` provides a second `TenantManagerService` instance (duplicate DataSource cache).
- `R2Module` lists `TenantModule` as a provider instead of importing it.
- `PaymentsService` writes `canceledAt`/`failedAt` properties that are not entity columns
  (silent no-ops). `payment.entity.ts` has a stale comment calling the module a scaffold.
- Storefront `src/app/page.tsx` debug button and the login/401 `console.log`s were removed, and the
  swallowed `catch {}` blocks in register/cart/checkout now surface errors (2026-10-08 review).
- Storefront `.gitignore` now covers `.env*.local` (including `.env.production.local`).
- Dashboards import Refine Devtools: `tenant_dash` now gates them behind `import.meta.env.DEV`
  (2026-10-09) so they are tree-shaken from its production bundle; `super_admin_dash` still imports
  them unconditionally. Both bind port 5001 in dev (set `REFINE_DEVTOOLS_PORT` to separate).

## Verification commands

- `pnpm --filter saas_store_api test` — API unit specs.
- `pnpm --filter saas_store_api typecheck` / `pnpm --filter tenant_dash build` — build gates.
- `pnpm --filter tenant_dash test` — store owner Vitest.
- `docker compose up -d postgres` then `pnpm --filter saas_store_api dev` for manual API checks.

## Manual integration scripts (need live Postgres + `.env`)

`test/verify-tenant-provision.ts`, `verify-tenant-guard.ts`, `verify-tenant-lifecycle.ts`,
`verify-register-store-guard.ts`, `reset-dev-db.ts`, `seed-load-test.ts`,
`verify-email-otp.ts`, `migrate-otp-challenges.ts` (see `apps/api/AGENTS.md`).
