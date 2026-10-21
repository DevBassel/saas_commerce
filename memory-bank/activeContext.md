# Active Context — saas_commerce

Current focus and recent changes. This file is **rewritten**, not appended, on every update.
Most dynamic file in the bank — keep it short and current.

## Current focus

**Super Admin bundle optimization, on top of the embedded `/platform` dashboard** (all
uncommitted). The Vite build is split by vendor chunk and route, Refine Devtools are
development-only, and the API still serves the built dashboard from `apps/api/static` at
`http://localhost:4000/platform`. API routes, guards, tenant resolution, Store Owner dashboard,
auth, and Refine resources are unchanged. Plans:
`.kilo/plans/1792427730268-super-admin-bundle-split.md` (bundle) and
`.kilo/plans/1792425806785-serve-super-admin-dashboard-at-platform.md` (embedded hosting).
Container deployment is now API-only Compose: API + Redis, with Postgres external.

## Recent changes

- 2026-10-19 — Docker surface reduced to API-only Compose (uncommitted):
  - Deleted `apps/store_owner_dashboard/Dockerfile`, `apps/super_admin_dashboard/Dockerfile`,
    `apps/tenant_store/Dockerfile`, `apps/api/Dockerfile.dev`, `apps/api/.dockerignore`, and the
    obsolete four-service `RAILWAY.md`.
  - `apps/api/Dockerfile` is now a production multi-stage image that builds the embedded Super
    Admin dashboard, then the NestJS API, and runs `node dist/main`.
  - `compose.yaml` builds only the API and runs it with Redis; no bind mounts or watch mode.
    Postgres is external, with `DB_HOST` defaulting to `host.docker.internal`. The frontends run
    from source.
- 2026-10-19 — Super Admin bundle split (uncommitted):
  - `apps/super_admin_dashboard/vite.config.ts` — `manualChunks` (Windows path-normalized) for
    `devtools` (dev-only), `react`, `refine` (core, devtools-internal/shared, react-router adapter,
    kbar, `@tanstack/react-query`), `router`, `http`, `tables`, `forms`; `undefined` for everything
    else. No broad Radix/lucide/sonner groups.
  - `src/App.tsx` — Devtools wrapped in a `import.meta.env.DEV` gate (tenant_dash pattern); every
    page except `Dashboard` and the `*` error route is `React.lazy()` with named-export mapping,
    served through `Suspense` inside `Layout` (`/login` has its own full-screen fallback).
  - New `src/components/refine-ui/layout/route-fallback.tsx` (centered `Loader2`, `role="status"`).
  - **Measured** (standalone build): 1,073.62 kB raw / 330.16 kB gzip in one chunk → 782.05 kB raw
    / 252.00 kB gzip initial (entry 250.71 + react 187.72 + router 38.81 + refine 252.43 + http
    52.38). No >500 kB warning. `tables` (73.72 kB) and `forms` (92.65 kB) are route-only.
  - **Verified:** typecheck, lint (pre-existing warnings only), standalone and embedded builds.
    Served by the running API on port 4000: `/platform`, `/platform/login`,
    `/platform/tenants/show/1` return HTML; entry/react/CSS assets return 200 under
    `/platform/assets`; a missing hash returns 404; `/api/v1/health` is 200. No
    `DevtoolsPanel`/`refine-devtools` strings in `apps/api/static/assets/*.js`, and all 36
    dynamically referenced chunks exist. Browser sign-in/navigation and Ctrl+K were not manually
    exercised.
  - Docs updated: `apps/super_admin_dashboard/AGENTS.md` (dev-only Devtools, bundle-splitting
    notes, measured sizes).
- 2026-10-19 — Embedded `/platform` dashboard (uncommitted):
  - `@nestjs/serve-static@^4.0.2` in `saas_store_api`; `apps/api/src/app.module.ts` registers two
    `ServeStaticModule.forRoot` entries (`renderPath: '/'` and `renderPath: '/:path*'` with a
    dotted-path `exclude`) so `/platform` and extensionless deep links serve the SPA while missing
    assets 404.
  - `vite.config.ts` uses `base: '/platform/'`, `outDir: ../api/static`, `emptyOutDir: false` for
    embedded builds; `BUILD_STANDALONE=true` restores `dist`, base `/`, `emptyOutDir`.
  - `src/App.tsx` derives `BrowserRouter basename` from `import.meta.env.BASE_URL`;
    `src/api/client.ts` redirects to `${BASE_URL}login`.
  - The dashboard `turbo.json` declares the embedded output and hashes `BUILD_STANDALONE`;
    `apps/api/.gitignore` ignores `/static`.
- 2026-10-18 — Redis-only API caching (committed as `5248de9`): six catalog/plan reads, namespace
  versions and cross-instance invalidation, forced `Cache-Control: no-store`, `X-Cache`, and cache
  stats in `GET /health`. `REDIS_URL` is required. Details in `progress.md` and
  `apps/api/AGENTS.md` → Caching.
- 2026-10-09 — Tenant and Super Admin subscription checkout/cancel/refund flows (committed as
  `8a93350`); see `progress.md` and `apps/api/AGENTS.md` → Payments, Subscriptions.

## Decisions taken

- The dashboard is **embedded** in the API for `/platform` production serving. Only the API is
  containerized (Compose); the dashboards and storefront run from source. `BUILD_STANDALONE=true`
  remains a build-only option for a standalone `dist`.
- `/platform` stays outside the global prefix; no API route or global guard changed.
- The SPA fallback is extensionless-only; missing assets must 404 rather than receive
  `index.html`.
- Two `ServeStaticModule` registrations are deliberate (root + deep links + dotted-path exclude).
  Do not "simplify" back to a single custom-regex `renderPath` while the API stays on Express 4.
- `apps/api/static` is build output and is gitignored; no clean script or `nest build` may delete
  it beyond the Vite build's own output.
- Bundle splitting is conservative: only stable initial-runtime vendors get names. Route-only
  libraries are left unassigned so Rollup keeps them with their lazy route; `Dashboard` stays
  static (no post-auth waterfall); React, `scheduler`, and `react-dom` stay in one chunk and
  `@tanstack/react-query` stays with `@refinedev/core`.
- `manualChunks` must normalize `\` to `/`; on Windows the IDs are absolute `C:\...` paths.

## Working tree state (check before relying on HEAD)

HEAD is `5248de9` (`feat: add redis caching layer`). The `/platform` hosting and bundle-split work
is uncommitted, including `apps/api/static` (gitignored) and `apps/super_admin_dashboard/dist`
(standalone build). Verify with `git status --short`; memory-bank entries older than the latest
session may describe work already committed.

## Known tooling issues

- Docker Desktop was not running on 2026-10-19, so the API image build and `docker compose up`
  were not verified. Host Postgres (5432) and Redis (6379) were reachable and the compiled API on
  port 4000 served `/platform`.
- `pnpm install` can crash with a pnpm (Rust) allocator failure; retry with `pnpm install
  --prefer-offline`.
- Full-repo `pnpm --filter saas_store_api lint` can OOM; lint changed files with
  `NODE_OPTIONS=--max-old-space-size=4096 npx eslint <files> --fix`. `pnpm --filter saas_store_api
  test` may OOM; use `-- --runInBand`.
- `pnpm --filter tenant_dash test` can OOM (exit 134); use
  `pnpm --filter tenant_dash exec vitest run --no-file-parallelism`.
- `next build` for `tenant_store` can OOM; use `NODE_OPTIONS=--max-old-space-size=8192`.

## Next steps

- Manual browser smoke of `/platform`: unauthenticated redirect to `/platform/login`, sign in,
  dashboard load, each list/detail/create/edit chunk on first navigation, deep-link refresh
  (`/platform/tenants/show/1`), logout, Ctrl+K command bar, and no Devtools request in production.
- Rebuild both artifacts in either order (`pnpm --filter super_admin_dash build`,
  `pnpm --filter saas_store_api build`) whenever the dashboard changes; the API serves whatever is
  currently in `apps/api/static`.
- When Docker is available, run `docker compose up -d --build` and check `/api/v1/health` plus
  `/platform` in the API container.
- Consider committing the `/platform` + bundle work; no commit was made in this session.
