# AGENTS.md — saas_commerce monorepo

Single pnpm + Turborepo workspace for the multi-tenant SaaS commerce platform: one NestJS API,
two Refine/Vite admin consoles, and one Next.js customer storefront.

Per-app instructions live next to each app and are authoritative for that app:

- `apps/api/AGENTS.md` — architecture, multi-tenancy, guards, entities, seeding, payments, coupons.
- `apps/store_owner_dashboard/AGENTS.md` — tenant admin console.
- `apps/super_admin_dashboard/AGENTS.md` — platform console.
- `apps/tenant_store/AGENTS.md` — public storefront.

This root file covers only cross-cutting facts: workspace layout, commands, shared contracts,
workspace rules, deployment, and invariants that must not change.

## Workspace layout

| Path | Package name | Stack | Dev port |
| --- | --- | --- | --- |
| `apps/api` | `saas_store_api` | NestJS 10, TypeORM 0.3, PostgreSQL 16 | 4000 |
| `apps/store_owner_dashboard` | `tenant_dash` | Refine v5, Vite 6, React 19 | 5174 |
| `apps/super_admin_dashboard` | `super_admin_dash` | Refine v5, Vite 6, React 19 | 5173 |
| `apps/tenant_store` | `tenant_store` | Next.js 16 App Router, React 19 | 3000 |

Package names are unchanged from the source repositories, so Turborepo filters use them verbatim.
`packages/*` is a declared workspace glob and is intentionally empty (only `.gitkeep`).

## Commands

Run from the repository root (`C:\works\saas_commerce`):

- `pnpm install` — one install for the whole workspace (single root `pnpm-lock.yaml`, single root `.npmrc`).
- `pnpm dev` — `turbo run dev`, parallel and persistent: API 4000 + SPAs 5173/5174 + storefront 3000.
- `pnpm build` — `turbo run build`.
- `pnpm lint` / `pnpm typecheck` / `pnpm test` — `turbo run <task>`.
- `pnpm start` — `turbo run start` (depends on `build`).
- `pnpm clean` — removes `dist`, `build`, `coverage`, `.turbo`, `node_modules` from the root and every app.

Multi-tenant k6 load tests live in `load-tests/k6/` (README there). They require at least 10
tenants, seed via `apps/api/test/seed-load-test.ts`, and report per tenant.

Target one package with a filter, for example:

```bash
pnpm --filter saas_store_api test
pnpm --filter tenant_dash build
turbo run lint --filter super_admin_dash
```

`turbo.json` tasks: `build` (`dependsOn: ["^build"]`, outputs `dist/**`, `.next/**`,
`!.next/cache/**`), `lint`, `typecheck`, `test` (outputs `coverage/**`), `dev` (no cache,
persistent), `start` (`dependsOn: ["build"]`, no cache). There is deliberately no `test → build`
dependency: the API tests run through `ts-jest`.

`super_admin_dash` and `tenant_store` have **no** `test` task and no test setup — do not invent one.
Turborepo skips packages that lack a task.

Both dashboards start a Refine Devtools server on port 5001, so running them together logs a
non-fatal "port 5001 already in use" for the second one. Set `REFINE_DEVTOOLS_PORT` to separate
them. Their Vite servers use 5174 (store owner) and 5173 (super admin).

## Shared contracts between apps

These are the interfaces every frontend must honor when talking to the API.

- API base path is `/api/v1` (`API_PREFIX`/`API_VERSION` env, default `api`/`v1`). The frontends
  configure it once: `VITE_API_URL` for both dashboards, `NEXT_PUBLIC_BACKEND_URL` for the storefront.
- Tenant context travels on the `x-tenant-slug` header (or `x-tenant-id`, or the request subdomain).
  The API resolves it to a `tenant_<slug>` schema. The store-owner dashboard and the storefront
  derive the slug from the first `Host` label; the super-admin dashboard is not tenant-scoped and
  never sends the header.
- Auth is stateless JWT. Access tokens are sent as `Authorization: Bearer <token>`. Refresh tokens
  are rotated server-side, so refresh must be single-flight in every client. Access tokens are
  never sent to a tenant that does not match their `tenantId`/`tenantSchema` claims.
- `CORS_ORIGIN` in `apps/api` is a comma-separated exact allowlist of browser origins (no globs).
  `src/main.ts` additionally accepts any origin whose host is `APP_ROOT_DOMAIN` or a subdomain of
  it, on any scheme and port, via `src/common/config/cors.util.ts`. That is how tenant subdomains
  such as `http://my-store.localhost:5174` pass preflight. Keep `apps/api/.env` and `.env.example`
  in sync with the SPA dev ports (5173, 5174) and the storefront (3000).

## Environment files

Every app has its own gitignored `.env`; only `.env.example` is committed at each level. The root
`.env` feeds Docker Compose (Postgres) only.

- `apps/api/.env` — full API config, Joi-validated at boot.
- `apps/store_owner_dashboard/.env` — `VITE_API_URL`.
- `apps/super_admin_dashboard/.env` — `VITE_API_URL`.
- `apps/tenant_store/.env` — `NEXTAUTH_URL`, `NEXTAUTH_SECRET`, `NEXT_PUBLIC_BACKEND_URL`,
  `NEXT_PUBLIC_APP_ROOT_DOMAIN`, `R2_PUBLIC_URL`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`.
- root `.env` — `DB_NAME`, `DB_USERNAME`, `DB_PASSWORD`, `POSTGRES_HOST_PORT` for Compose.

Frontend `VITE_*` and `NEXT_PUBLIC_*` values are inlined at build time, so changing one requires a
rebuild of that app.

## Database

`compose.yaml` keeps the original Compose project name `saas_store`, so the container
(`saas_store_db`) and volume (`saas_store_postgres_data`) match the pre-merge deployment and
existing tenant schemas survive.

```bash
docker compose up -d postgres
```

Use the `postgres` service name as `DB_HOST` from inside a container; from the host it is
`127.0.0.1`. Per-tenant schema details are in `apps/api/AGENTS.md`.

## Docker and deployment

All four images build from the repository root context:

```bash
docker build -f apps/api/Dockerfile .
docker build -f apps/store_owner_dashboard/Dockerfile .
docker build -f apps/super_admin_dashboard/Dockerfile .
docker build -f apps/tenant_store/Dockerfile .
```

`apps/api/Dockerfile.dev` is the watch-mode development image used by the commented Compose API
service. `RAILWAY.md` documents the four Railway services plus a Postgres plugin; note it predates
the implemented payments module and should be read against `apps/api/AGENTS.md`.

## Workspace rules

- Never add a nested `pnpm-workspace.yaml`, `pnpm-lock.yaml`, or `.npmrc` under `apps/*`. They were
  removed during the merge and would silently split dependency resolution.
- `allowBuilds` lives only in the root `pnpm-workspace.yaml`. `bcrypt` is the canary: if native build
  scripts are blocked, API auth fails at runtime and the key merge is wrong.
- Keep the root `engines.node` (`>=20`) satisfiable by the API image (Node 26) and the dashboards
  (Node 20-compatible Vite). The storefront image uses Node 22.
- `.npmrc` sets `legacy-peer-deps=true` and `strict-peer-dependencies=false`; do not remove without
  checking every app's install.

## Behavior that must stay byte-identical

These were deliberately preserved when the source repositories were merged. Do not "clean them up":

- Compose project/container names (`saas_store`, `saas_store_db`) and the volume `postgres_data`
  (stays `saas_store_postgres_data`) so existing tenant data keeps resolving.
- `APP_NAME`, `DB_NAME`, `R2_BUCKET`, `JWT_ISSUER`, `JWT_AUDIENCE`. Changing the JWT pair
  invalidates every issued access/refresh token; changing `DB_NAME`/`R2_BUCKET` orphans data.
- All four workspace `package.json` names.
- Store-owner `localStorage` keys `tenant-access-token`, `tenant-email`, `tenant-refresh-token`.
- Super-admin `localStorage` keys `saas-admin-access-token`, `saas-admin-email`,
  `saas-admin-refresh-token`, and the dashboards' sign-in labels.

## Archives

`C:\works\saas_store`, `C:\works\dash\tenant_dash`, and `C:\works\dash\super_admin_dash` are frozen
archives. The monorepo imported the committed `main` of the first two (identical SHAs, plus the
`pre-cleanup` tag) and a plain copy of the third (its source repo had zero commits). Do not push to
the old remotes or edit the archives.

## Memory Bank

My memory resets between sessions. The `memory-bank/` directory is this project's persistent
context and I must read it before acting.

**At the start of every task:** read ALL files in `memory-bank/` —
`projectbrief.md`, `productContext.md`, `systemPatterns.md`, `techContext.md`,
`activeContext.md`, `progress.md`. If any are missing, say which and offer `/memory-bank-init`.
Only then plan and act, treating the bank as authoritative context.

**Before finishing a task that changed behavior, decisions, or state:** update the affected
files. `activeContext.md` is rewritten, never appended. When the user says "update memory bank",
review every file.

**Do not** store secrets, tokens, credentials, or `.env` values. Do not copy durable rules that
already live in the `AGENTS.md` files — link to them instead (for example
`apps/api/AGENTS.md` → Multi-tenancy). The bank records state and decisions over time; the
`AGENTS.md` files record durable rules.

Commands: `/memory-bank-init` bootstraps or refreshes the bank from repository evidence;
`/memory-bank-update` syncs it with current work.
