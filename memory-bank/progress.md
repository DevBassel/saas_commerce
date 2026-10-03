# Progress — saas_commerce

What works, what is left, and known issues. Update when work completes or debt is found.

## What works

- **API** (`saas_store_api`): schema-per-tenant isolation, tenant resolution + guards, JWT auth
  with rotation, RBAC (43 seeded permissions), products/categories/cart/orders/addresses/coupons,
  implemented Stripe payments (PaymentIntent, webhook, Connect), R2 storage with quotas, platform
  endpoints, dashboard endpoints, currency requests. ~58 unit spec files.
- **Store owner dashboard** (`tenant_dash`): auth + single-flight refresh, tenant-scoped lists and
  forms for products/categories/orders/users, payments and store settings. Ten Vitest files.
- **Super admin dashboard** (`super_admin_dash`): tenant provisioning/lifecycle, platform payments
  oversight, currency request approve/reject.
- **Storefront** (`tenant_store`): subdomain tenant resolution, NextAuth credentials login, catalog
  by numeric id, cart, checkout, Stripe payment step, order history/cancel/return, refresh proxy.

## What is left / not wired

- No migrations system; tenant schemas rely on entity metadata + `DB_SYNCHRONIZE_TENANTS`.
- `TenantService.getSchemaSizes` exists but is not exposed by any endpoint; platform tenant listing
  returns raw tenant rows (no storage usage view).
- `categories.seed.ts` (`BASE_CATEGORIES`, `seedCategories`) is dead code — provision/reseed do not
  create base categories.
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
