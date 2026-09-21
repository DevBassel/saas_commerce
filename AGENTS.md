# AGENTS.md — saas_commerce monorepo

Single pnpm + Turborepo workspace holding the multi-tenant SaaS commerce platform.

- `apps/api` — package `saas_store_api` (NestJS 10 + TypeORM 0.3 + Postgres 16).
- `apps/store_owner_dashboard` — package `tenant_dash` (Refine v5 + Vite 6 + React 19).
- `apps/super_admin_dashboard` — package `super_admin_dash` (Refine v5 + Vite 6 + React 19).

Package names are unchanged from the source repositories, so Turborepo filters use them verbatim.
`packages/*` is a declared workspace glob and is intentionally empty.

## Commands

Run from the repository root (`C:\works\saas_commerce`):

- `pnpm install` — one install for the whole workspace (single root `pnpm-lock.yaml`).
- `pnpm dev` — `turbo run dev`, parallel and persistent: API 4000 + SPAs 5173/5174.
- `pnpm build` / `pnpm lint` / `pnpm typecheck` / `pnpm test` — `turbo run <task>`.
- `pnpm clean` — removes `dist`, `build`, `coverage`, `.turbo`, `node_modules` from the root and all apps.
- Filtered: `pnpm --filter saas_store_api test`, `pnpm --filter tenant_dash build`, `turbo run lint --filter super_admin_dash`.

`turbo.json` tasks: `build` (`dependsOn: ["^build"]`, outputs `dist/**`), `lint`, `typecheck`,
`test` (outputs `coverage/**`), `dev` (no cache, persistent). There is deliberately no `test →
build` dependency (the API tests run through `ts-jest`).

`super_admin_dash` has **no** `test` task and no test setup — do not invent one; Turborepo skips
packages that lack a task.

Both dashboards start a Refine Devtools server on port 5001, so running them together logs a
non-fatal "port 5001 already in use" for the second one. Set `REFINE_DEVTOOLS_PORT` to separate
them if needed. Their Vite servers use 5174 (store owner) and 5173 (super admin).

## Workspace rules

- Never add a nested `pnpm-workspace.yaml`, `pnpm-lock.yaml`, or `.npmrc` under `apps/*`. They were
  removed during the merge and would silently split dependency resolution.
- `allowBuilds` lives only in the root `pnpm-workspace.yaml`. `bcrypt` is the canary: if native build
  scripts are blocked, API auth fails at runtime and the key merge is wrong.
- Keep the root `engines.node` (`>=20`) satisfiable by the API image (Node 26) and the dashboards
  (Node 20 compatible).
- Docker images all build from the repository root context: `docker build -f apps/<app>/Dockerfile .`.

## Per-app notes

### `apps/api`

`apps/api/AGENTS.md` is the authoritative, detailed architecture doc (guard order, schema-per-tenant
model, seeding, storage, environment groups, conventions). Read it before touching the API; this
section only records what the monorepo changed.

- Standardized scripts: `dev` (alias of the retained `start:dev`), `typecheck`. `start:dev`, `build`,
  `lint`, `test`, `test:e2e` are unchanged.
- `CORS_ORIGIN` is a comma-separated exact allowlist of browser origins. `src/main.ts` additionally
  allows any origin whose host is `APP_ROOT_DOMAIN` or a subdomain of it, on any scheme and port, via
  `src/common/config/cors.util.ts` — that is how tenant dashboard subdomains such as
  `http://my-store.localhost:5174` pass preflight. Keep `.env` and `.env.example` in sync with the
  SPA dev ports (5173, 5174); no glob/`*` entries are supported.
- `test:e2e`, `test/verify-*.ts`, and `test/reset-dev-db.ts` are manual and need a live Postgres.
- `synchronize: true` per tenant schema is dev-only; there is no migrations infrastructure.
- Never add tenant entities to `PUBLIC_ENTITIES` in `src/core.module.ts`; add them to
  `src/modules/tenants/tenant-entities.ts`.

### `apps/store_owner_dashboard`

- Standardized scripts added: `lint` (`eslint .`) and `typecheck` (`tsc --noEmit`); `dev`, `build`,
  `test` (Vitest) are unchanged.
- Pinned to dev port **5174** in `vite.config.ts`.
- Infers the tenant from `window.location.hostname.split(".")[0]` and sends it as `x-tenant-slug`
  (`src/api/tenant.ts`). JWTs are kept in `localStorage`.

### `apps/super_admin_dashboard`

- No `test` task. Standardized scripts added: `lint` and `typecheck`.
- Pinned to dev port **5173** in `vite.config.ts`.
- Admin session `localStorage` keys (`saas-admin-access-token`, `saas-admin-email`,
  `saas-admin-refresh-token` in `src/api/constants.ts`) must not be renamed — renaming drops saved
  admin sessions.

## Behavior that must stay byte-identical

These were deliberately preserved when the three repositories were merged. Do not "clean them up":

- Compose project/container names (`saas_store`, `saas_store_db`) and the volume `postgres_data`
  (stays `saas_store_postgres_data`) so existing tenant data keeps resolving.
- `APP_NAME`, `DB_NAME`, `R2_BUCKET`, `JWT_ISSUER`, `JWT_AUDIENCE` (changing the JWT pair invalidates
  every issued access/refresh token; changing `DB_NAME`/`R2_BUCKET` orphans data).
- All three workspace `package.json` names.
- Super admin `localStorage` keys and the dashboards' sign-in labels.

## Database

`docker compose up -d postgres` starts `postgres:16-alpine` from the root `compose.yaml`. Use the
`postgres` service name as `DB_HOST` from inside a container; from the host it is `127.0.0.1`.

## Archives

`C:\works\saas_store`, `C:\works\dash\tenant_dash`, and `C:\works\dash\super_admin_dash` are frozen
archives. The monorepo imported the committed `main` of the first two (identical SHAs, plus the
`pre-cleanup` tag) and a plain copy of the third (its source repo had zero commits). Do not push to
the old remotes or edit the archives.
