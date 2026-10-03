# Progress — saas_commerce

What works, what is left, and known issues. Update when work completes or debt is found.

## What works

- **API** (`saas_store_api`): schema-per-tenant isolation, tenant resolution + guards, JWT auth
  with rotation, RBAC (45 seeded permissions), products/categories/cart/orders/addresses/coupons,
  implemented Stripe payments (PaymentIntent, webhook, Connect), R2 storage with quotas, platform
  endpoints, dashboard endpoints, currency requests, and SaaS subscription plans (limits/features,
  Super-Admin assignment + platform reads for a tenant's subscription and usage, tenant read-only
  APIs, enforcement in user/coupon/product/order flows, plus an opt-in HTTP-layer
  `SubscriptionGuard` on annotated routes). ~75 unit spec files.
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
  forms for products/categories/orders/users, payments and store settings. Ten Vitest files.
- **Super admin dashboard** (`super_admin_dash`): tenant provisioning/lifecycle, platform payments
  oversight, currency request approve/reject, and subscription plan CRUD (list/create/edit/delete)
  plus a per-tenant subscription panel (current plan/status/period, live usage, change plan +
  interval, cancel/reactivate) backed by the platform subscription reads.
- **Storefront** (`tenant_store`): subdomain tenant resolution, NextAuth credentials login, catalog
  by numeric id, cart, checkout, Stripe payment step, order history/cancel/return, refresh proxy.

## What is left / not wired

- No migrations system; tenant schemas rely on entity metadata + `DB_SYNCHRONIZE_TENANTS`. The
  public-schema subscription tables are also created by `synchronize`, not migrations.
- Stripe SaaS billing is **deferred**: subscription `stripeCustomerId`/`stripeSubscriptionId`/
  `stripePriceId` columns exist but are unused; plans are assigned by Super Admin only.
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
- Storefront `src/app/page.tsx` has a leftover debug button calling `apiClient.get("/products")`;
  several `catch {}` blocks swallow errors.
- Storefront `.gitignore` does not cover `.env.production.local` (a placeholder file exists).
- Dashboards import Refine Devtools unconditionally, so they ship in the production bundle and both
  bind port 5001 (set `REFINE_DEVTOOLS_PORT` to separate).

## Verification commands

- `pnpm --filter saas_store_api test` — API unit specs.
- `pnpm --filter saas_store_api typecheck` / `pnpm --filter tenant_dash build` — build gates.
- `pnpm --filter tenant_dash test` — store owner Vitest.
- `docker compose up -d postgres` then `pnpm --filter saas_store_api dev` for manual API checks.

## Manual integration scripts (need live Postgres + `.env`)

`test/verify-tenant-provision.ts`, `verify-tenant-guard.ts`, `verify-tenant-lifecycle.ts`,
`verify-register-store-guard.ts`, `reset-dev-db.ts`, `seed-load-test.ts` (see `apps/api/AGENTS.md`).
