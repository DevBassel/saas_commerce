# Tech Context — saas_commerce

Technologies, workspace layout, and how to run things. Authoritative detail in the root and
per-app `AGENTS.md` files.

## Stack

- **Runtime/PM:** Node `>=20` (root `engines`), pnpm workspace + Turborepo. Single root
  `pnpm-lock.yaml` and `.npmrc` (`legacy-peer-deps=true`).
- **API:** NestJS 10, TypeORM 0.3, PostgreSQL 16, Joi-validated env, pino logging, helmet,
  Swagger at `/api/v1`, `@aws-sdk/client-s3` for R2, Stripe SDK.
- **Dashboards:** Refine v5, Vite 6, React 19, React Router 7, axios, Tailwind v4 (CSS-first),
  shadcn/ui, react-hook-form + zod. Store owner adds Vitest; super admin has none.
- **Storefront:** Next.js 16 App Router, React 19, NextAuth v4 (JWT), Tailwind v4, Base UI
  primitives, Stripe.js.

## Workspace layout

```
apps/api                     saas_store_api      4000
apps/store_owner_dashboard   tenant_dash         5174
apps/super_admin_dashboard   super_admin_dash    5173
apps/tenant_store            tenant_store        3000
packages/*                   intentionally empty
load-tests/k6                k6 load tests (need >=10 seeded tenants)
compose.yaml                 Postgres (project name saas_store)
```

## Commands (from repo root)

- `pnpm install`, `pnpm dev`, `pnpm build`, `pnpm lint`, `pnpm typecheck`, `pnpm test`,
  `pnpm start`, `pnpm clean` — all `turbo run <task>`.
- Target one package: `pnpm --filter saas_store_api test`, `pnpm --filter tenant_dash build`.
- `turbo.json` has deliberate choices: no `test → build` dependency; `dev`/`start` uncached;
  `start` depends on `build`.

## Database

- `docker compose up -d postgres` — container `saas_store_db`, volume
  `saas_store_postgres_data` (kept from the pre-merge deployment so existing schemas survive).
- Host `DB_HOST=127.0.0.1`; from inside a container use `postgres`.
- Per-tenant schemas are created from entity metadata; no migrations. `DB_SYNCHRONIZE_TENANTS`
  (default false) is the production opt-in for tenant `synchronize`.

## Environment files

Every app has its own gitignored `.env`; only `.env.example` is committed.

- `apps/api/.env` — full config, Joi-validated. Stripe keys required (blank values fail boot).
- `apps/store_owner_dashboard/.env`, `apps/super_admin_dashboard/.env` — `VITE_API_URL`.
- `apps/tenant_store/.env` — `NEXTAUTH_URL`, `NEXTAUTH_SECRET`, `NEXT_PUBLIC_BACKEND_URL`,
  `NEXT_PUBLIC_APP_ROOT_DOMAIN`, `R2_PUBLIC_URL`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`.
- root `.env` — Postgres values for Compose only.

`VITE_*` / `NEXT_PUBLIC_*` are inlined at build time; changing one requires a rebuild.

## Docker

All four images build from the repository root context:
`docker build -f apps/<app>/Dockerfile .`. `RAILWAY.md` documents the Railway services but
predates the implemented payments module.

## Tooling notes

- `apps/api` ESLint is flat config and `lint` auto-fixes (mutates files).
- Store owner typecheck is strict with `noUnusedLocals`/`noUnusedParameters`; unused imports fail
  `typecheck` and `build`.
- `NEXT_STANDALONE=1` is build-only and must never be set for a local Windows build.
- Kilo agent config lives in `.kilo/`; the Memory Bank wiring is described in `AGENTS.md`.
