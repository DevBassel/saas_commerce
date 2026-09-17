# tenant_dash — Remediation Plan

Source: React/TypeScript audit of the Refine v5 + Vite 6 + React 19 SPA.
Rules: incremental fixes only; no architectural rewrite. One PR per phase item where practical.
Status: **implemented** (all items checked). Verification at the bottom.

## Context / Architecture

- Vite + React 19 + TS strict SPA, Refine v5, React Router v7, shadcn/ui + Tailwind v4.
- Data via custom `DataProvider` (`src/providers/data.ts`) over Axios (`src/api/client.ts`).
- Auth via custom `authProvider` (`src/providers/auth.ts`), JWT in `localStorage`.
- Tenant inferred from `window.location.hostname.split(".")[0]` -> `x-tenant-slug`.

## Phase 1 — Critical (security + correctness)

- [x] C1 Tenant isolation: added `src/api/tenant.ts` with a best-effort host/JWT tenant
      cross-check wired into `authProvider.check`. Backend MUST still derive tenant from the
      authenticated principal (documented in README). Frontend is a UX guard only.
- [x] C2 Fixed the global 401 interceptor: auth endpoints (`auth/login`, `auth/register`,
      `auth/refresh`) are excluded, and 401 handling is now refresh-then-retry rather than an
      unconditional hard redirect (no more login-request hijack / double redirect).
- [x] C3 `getList` now forwards `page`/`limit`/`sortBy`/`sortOrder` to the API and consumes
      `{ data, total }`, with a plain-array fallback for backends that ignore params.
      `getMany` requests by ids instead of downloading the whole resource.
- [x] H3 Removed hardcoded login credentials.

## Phase 2 — High

- [x] H2 Single ThemeProvider (removed the nested provider in `Layout`).
- [x] H1 Implemented single-flight refresh-on-401 (`auth/refresh`); on failure the session is
      cleared. Missing `exp` is now treated as invalid.
- [x] H4 Password a11y: login `InputPassword` gets an `id`, and the visibility toggle has
      `aria-label` + `aria-pressed`.
- [x] H5 Added `src/components/ErrorBoundary.tsx` wrapping the app tree in `App.tsx`.
- [x] H6 Documented single-role + backend-only enforcement in `README.MD`
      (no frontend RBAC layer; backend is the security boundary).

## Phase 3 — Medium

- [x] M2 Removed the prop→state sync effect in `ProductImagesManager`; re-syncs only when the
      server image signature changes (render-phase adjustment, optimistic updates preserved).
      Invalidates both `list` and `detail`.
- [x] M3 `ErrorComponent` derives its message during render (effect removed).
- [x] M4 Table overflow uses a `ResizeObserver` on the table + container (no timer/resize
      listener; avoids redundant state updates).
- [x] M5 Sign-in converted to react-hook-form + Zod (`auth-schema.ts`).
- [x] M6 Unsupported filter operators now throw instead of silently matching everything.
- [x] M7 Removed the per-request `console.log` leaking the tenant/host.
- [x] M8 Added `.env.example` and documented `VITE_API_URL`.
- [x] M9 Enabled `noUnusedLocals` (clean tsc).

## Phase 4 — Optimization / Cleanup

- [x] Deleted the dead `data-table-filter.tsx` module.
- [x] Deleted unused components: `theme-select`, `user-info`, `loading-overlay`,
      `sign-up-form`, `forgot-password-form`, `buttons/list`, `buttons/clone`.
- [x] Deleted unused `src/components/ui/*` primitives and the now-orphaned `command`/`calendar`
      (kept `sheet`, which `ui/sidebar.tsx` imports internally).
- [x] Removed unused deps (`dayjs`, `recharts`, `next-themes`, `embla-carousel-react`,
      `input-otp`, `vaul`, `cmdk`, `react-resizable-panels`, `@refinedev/rest`,
      `@refinedev/simple-rest`, `react-day-picker`, `date-fns`, the unused `@radix-ui/*`
      packages) and the duplicate v5 `@typescript-eslint` pair. Lockfile refreshed.
- [x] L3 Added `loading="lazy"` + `decoding="async"` (+ dimensions) to product images.
- [x] L2 Rewrote `Dockerfile` (single package manager, Node 20, explicit port).
- [x] Tests: added Vitest + jsdom with 36 tests across `query-utils`, `product-schema`,
      `client` (`toApiError`/`tokenStorage`), `auth` (`decodeJwt`/`authProvider`), `tenant`.

## Verification

- `npx tsc --noEmit` — PASS (0 errors)
- `npx eslint .` — PASS (0 errors, 6 react-refresh warnings)
- `pnpm test` — PASS (5 files, 36 tests)
- `pnpm build` — PASS (2248 modules; ~998 kB / 312 kB gzip single chunk)

## Follow-ups (not in scope, surfaced by the build)

- Bundle: `@refinedev/devtools` is imported unconditionally and lands in the production
  bundle. Guard it with `import.meta.env.DEV` + dynamic import, and consider route-level
  `React.lazy` to split the ~1 MB single chunk.
- Confirm the backend refresh endpoint path (`POST /api/v1/auth/refresh`) and the
  `{ access_token, refresh_token }` response shape; adjust `src/api/client.ts` if different.
- Confirm the backend list contract (`page`, `limit`, `sortBy`, `sortOrder`, `{ data, total }`)
  and the `ids` param for `getMany`.
