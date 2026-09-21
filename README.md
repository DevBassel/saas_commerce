# saas_commerce

Monorepo for the multi-tenant SaaS commerce platform: a NestJS API, a tenant (store owner)
dashboard, and a super admin console. One root git repo, one `pnpm install`, Turborepo for
task orchestration.

- Architected a **schema-per-tenant SaaS commerce platform** using NestJS, TypeORM, and PostgreSQL, providing isolated `tenant_<slug>` schemas with tenant resolution via headers and subdomains.
- Built a **tenant-aware DataSource manager** with connection pooling, LRU caching, in-flight request deduplication, and automatic connection teardown to support scalable multi-tenant database access.
- Designed a **RBAC system** with granular permissions, hierarchical roles, super-admin privileges, and direct per-user permissions, with rank-based controls to prevent privilege escalation.
- Implemented **stateless JWT authentication** with separate access/refresh secrets, refresh-token rotation, JTI revocation, and tenant-bound claims to prevent cross-tenant token reuse.
- Automated the **tenant lifecycle**, including schema provisioning, RBAC/category seeding, boot-time tenant reseeding, and super-admin activation/deactivation with automatic DataSource and connection cleanup.
- Integrated **Stripe payment processing** with tenant-scoped payment workflows, payment status tracking, transaction handling, and controlled customer refunds through the Tenant Admin dashboard.
- Implemented **tenant-scoped Cloudflare R2 object storage** with per-tenant quotas, MIME/size validation, multi-file upload rollback, and PostgreSQL-based storage usage accounting for live capacity monitoring.
- Built a **Super Admin console** using React, TypeScript, Refine, React Router, shadcn/ui, and Tailwind CSS, supporting tenant provisioning, lifecycle management, RBAC inspection, and storage telemetry.
- Built the **Tenant Admin dashboard** with server-side pagination, sorting, category management, ordered product images, permission-aware staff administration, and authorized customer refund management.

## Layout

| Path | Package | Stack | Dev port |
| --- | --- | --- | --- |
| `apps/api` | `saas_store_api` | NestJS 10 + TypeORM 0.3 + Postgres | 4000 |
| `apps/store_owner_dashboard` | `tenant_dash` | Refine v5 + Vite 6 + React 19 | 5174 |
| `apps/super_admin_dashboard` | `super_admin_dash` | Refine v5 + Vite 6 + React 19 | 5173 |

`packages/*` is declared as a workspace glob but is intentionally empty for now.

## Requirements

- Node.js `>=20` (the API image uses Node 26; the dashboards are built on Node 20-compatible Vite).
- pnpm `12.4.1` (`corepack enable` honors the root `packageManager` field).
- Docker + Docker Compose for Postgres (`compose.yaml` at the root).

## Install

Run from the repository root:

```bash
pnpm install
```

A single root `pnpm-lock.yaml` covers all three apps. Do not run installs from `apps/*`, and do
not reintroduce a nested `pnpm-workspace.yaml` or lockfile.

## Commands (root, Turborepo)

```bash
pnpm dev        # turbo run dev — API + both SPAs in parallel
pnpm build      # turbo run build
pnpm lint       # turbo run lint
pnpm typecheck  # turbo run typecheck
pnpm test       # turbo run test (super_admin_dash has no test task and is skipped)
pnpm clean      # remove dist/, build/, coverage/, .turbo/, node_modules/ from all apps
```

Target one app with a pnpm filter (package names are unchanged from the source repos):

```bash
pnpm --filter saas_store_api build
pnpm --filter tenant_dash test
pnpm --filter super_admin_dash build
turbo run build --filter saas_store_api...
```

## Per-app commands

### `apps/api`

```bash
pnpm --filter saas_store_api dev        # nest start --watch (alias: start:dev)
pnpm --filter saas_store_api build      # nest build
pnpm --filter saas_store_api lint       # eslint --fix over src/test
pnpm --filter saas_store_api typecheck  # tsc --noEmit
pnpm --filter saas_store_api test       # jest unit specs
pnpm --filter saas_store_api test:e2e   # needs a live Postgres
```

Integration verify scripts and the dev-DB reset are manual and need a live Postgres plus a real
`apps/api/.env`; they are documented in `apps/api/AGENTS.md`.

### `apps/store_owner_dashboard`

```bash
pnpm --filter tenant_dash dev        # refine dev on http://localhost:5174
pnpm --filter tenant_dash build
pnpm --filter tenant_dash lint
pnpm --filter tenant_dash typecheck
pnpm --filter tenant_dash test       # Vitest
```

### `apps/super_admin_dashboard`

```bash
pnpm --filter super_admin_dash dev        # refine dev on http://localhost:5173
pnpm --filter super_admin_dash build
pnpm --filter super_admin_dash lint
pnpm --filter super_admin_dash typecheck
```

There is no `test` task for the super admin console yet.

## Database

`compose.yaml` keeps the original Compose project name `saas_store`, so the container
(`saas_store_db`) and the `saas_store_postgres_data` volume are the same ones used before the
merge — existing tenant schemas are preserved.

```bash
docker compose up -d postgres
```

Compose reads only the DB-related variables from the root `.env` (see `.env.example`):
`DB_NAME`, `DB_USERNAME`, `DB_PASSWORD`, `POSTGRES_HOST_PORT`.

## Environment files

Per-app `.env` files stay per-app and are gitignored; only `.env.example` is committed.

- `apps/api/.env` — full API config (Joi-validated at boot).
- `apps/store_owner_dashboard/.env` — `VITE_API_URL`.
- `apps/super_admin_dashboard/.env` — `VITE_API_URL`.
- root `.env` — Compose/Postgres only.

## Docker

All images build from the repository root:

```bash
docker build -f apps/api/Dockerfile .
docker build -f apps/store_owner_dashboard/Dockerfile .
docker build -f apps/super_admin_dashboard/Dockerfile .
```

## Source archives

The original repositories are frozen archives — do not edit them further:

- `C:\works\saas_store` → `apps/api` (git history imported; `main` and the `pre-cleanup` tag preserved)
- `C:\works\dash\tenant_dash` → `apps/store_owner_dashboard` (git history imported)
- `C:\works\dash\super_admin_dash` → `apps/super_admin_dashboard` (source repo had zero commits; imported as a plain copy)
