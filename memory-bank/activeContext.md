# Active Context — saas_commerce

Current focus and recent changes. This file is **rewritten**, not appended, on every update.
Most dynamic file in the bank — keep it short and current.

## Current focus

**Centralized database seeding module** (`apps/api/src/modules/seeding/`). One registry-driven
module owns every seeder, a CLI (`test/seed.ts`) drives platform/tenant/individual/single-tenant
runs, all seeders are idempotent/conflict-safe, and production seeding is guarded. The legacy seed
services in the feature modules were removed; all seed logic now lives in the seeding module.

## Recent changes

- 2026-10-03 — Seeding module (API):
  - New `src/modules/seeding/`: `SeederRegistry` (factory tokens `PLATFORM_SEEDERS`/`TENANT_SEEDERS`
    — Nest 10 has no multi-providers), `SeedingService`, `SeedingBootstrapService`, `seeding.module.ts`,
    interfaces, `constants/`, `helpers/{rbac.seed.ts,subscription-plan-seeding.ts}`, and
    `seeders/{platform,tenant}/`.
  - Platform seeders: `permissions` (10), `roles` (20), `super-admin` (30), `subscription-plans` (40),
    `subscription-backfill` (50). Tenant seeders: `permissions` (10), `roles` (20), opt-in
    `categories` (50). "Run all" skips `optIn` seeders.
  - `SeedingBootstrapService` is the single boot owner: platform seeders, then tenant seeders for
    ACTIVE tenants; platform failure fails boot, tenant failures only log; skipped when
    `SEED_CLI=true`.
  - Removed `RbacSeedService`, `SubscriptionSeedService`, `TenantReseedService`, `categories.seed.ts`;
    `TenantProvisionerService` calls the shared `seedRbac` helper in `seeding/helpers/rbac.seed.ts`.
  - Upserts are conflict-safe; `upsertPermissions`/categories clone their rows because TypeORM's
    `upsert` writes generated columns back into the passed objects (this previously corrupted the
    shared `SEED_PERMISSIONS`/`BASE_CATEGORIES` constants and re-emitted `id` as an update target,
    violating the products FK).
  - New `seeding` env group (`SEED_ALLOW_PRODUCTION`, default false). CLI refuses production seeding
    unless `SEED_ALLOW_PRODUCTION=true` **and** `--force`; boot bypasses the guard.
  - `test/seed.ts` CLI + scripts `seed`, `seed:platform`, `seed:tenants`, `seed:all`. Flags
    `--platform|--tenants|--all`, `--name` (repeatable/comma), `--tenant <id|slug>`, `--force`.
  - Tests: +34 seeding specs; full suite 993 pass serially. Typecheck + targeted lint pass.
  - Verified on the dev DB: `seed:platform` idempotent (row counts unchanged), `seed:tenants`,
    `--name permissions`, `--name categories` (14 tenants, 0 failures after the clone fix),
    `--tenant my-store`, unknown-name error, and a real boot (bootstrap ran).
- 2026-10-03 — Subscription entitlement guard, subscription API, Super Admin subscription UI (see
  prior notes: `SubscriptionGuard` global gate, `PRODUCTS` plan limit, Super Admin tenant
  subscription panel). Still uncommitted.

## Working tree state (check before relying on HEAD)

HEAD is `d3afa26`. `git status --short` shows large uncommitted work: the subscription API +
entitlement guard, Super Admin UI, schema-size feature, and now the seeding module. Nothing is
committed. Verify with `git status --short` before relying on HEAD.

## Active decisions

- Seeding is registry-driven via explicit DI registration (one provider line + factory array entry
  per seeder); no filesystem auto-discovery, no `seeder_runs` table, no migrations.
- Boot seeding must always run (bypasses the production guard); the guard applies to CLI runs only.
- Tenant identity resolves only through `TenantService` by id/slug; a raw schema name is never
  accepted. Tenant seeders always use the tenant DataSource from `TenantManagerService`.
- `categories` seeding is opt-in (`seed --tenants --name categories`) and never runs at boot or
  provision — preserves prior behavior.
- Platform console is not tenant-scoped; plans/subscriptions stay public entities; Stripe SaaS
  billing remains deferred.
- Entitlement enforcement coexists: `SubscriptionGuard` is an early HTTP gate for annotated routes;
  service-level `entitlements.assert*` stays authoritative.

## Known tooling issues

- Full-repo `pnpm --filter saas_store_api lint` can crash Node with
  `FATAL ERROR: Zone Allocation failed - process out of memory` on this Windows/Node 26 setup. Lint
  changed files with `npx eslint <files> --fix`.
- `pnpm --filter saas_store_api test` (parallel workers) can OOM; run with `-- --runInBand` (993 pass).
- Kilo CLI `Failed to parse frontmatter` for `.kilo/command|agent/*.md` is a CLI-side defect.

## Next steps

- Commit the seeding module together with the subscription/guard/UI/schema-size work (all
  uncommitted).
- Optional live check: open a tenant store and confirm base categories exist only after the opt-in
  seeder; confirm the super-admin can still log in (bootstrap super admin unchanged).
