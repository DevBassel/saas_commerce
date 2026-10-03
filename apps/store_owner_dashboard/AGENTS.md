# AGENTS.md — apps/store_owner_dashboard (`tenant_dash`)

Tenant (store owner) admin console. Refine v5 + Vite 6 + React 19 + React Router 7 + axios,
Tailwind v4, shadcn/ui (style `new-york`), Radix primitives, Vitest.

The root `AGENTS.md` covers cross-app contracts. This file is authoritative for this app.

## Commands

Run from the repository root with a filter, or from the app directory.

- `pnpm --filter tenant_dash dev` — `refine dev` on **port 5174** (`strictPort`).
- `pnpm --filter tenant_dash build` — `tsc && refine build`.
- `pnpm --filter tenant_dash typecheck` — `tsc --noEmit`.
- `pnpm --filter tenant_dash lint` — `eslint .` (flat config, no Prettier).
- `pnpm --filter tenant_dash start` — `refine start`.
- `pnpm --filter tenant_dash test` — `vitest run` (jsdom, `src/**/*.test.{ts,tsx}`).

## Dev URL and tenant header

The console is tenant-scoped by subdomain. Open `http://my-store.localhost:5174`, not
`http://localhost:5174`.

- `src/api/tenant.ts` `getTenantSlug()` returns `null` for `localhost`, IPv4 addresses, and any host
  with fewer than 3 dot-separated labels; otherwise it returns the first label. So
  `my-store.localhost` (2 labels) yields `null` and the JWT/tenant match guard is skipped, while
  `my-store.example.com` yields `my-store`.
- `src/api/client.ts` always sets `x-tenant-slug` from the first host label with no `localhost`
  special case, so a bare `localhost` sends `x-tenant-slug: localhost`.
- `src/providers/auth.ts` cross-checks the host slug against the JWT's tenant claim as a UX guard
  (skipped when the slug is `null`).

Always develop against a tenant subdomain so both paths agree.

## Layout and routing

- Entry is `src/index.tsx` (`index.html` loads `/src/index.tsx`); `src/App.tsx` wires
  `BrowserRouter → RefineKbarProvider → ThemeProvider → DevtoolsProvider → Refine`.
- Routing is React Router v7 `<Routes>`, not resource-driven. Auth-gated routes render inside
  `Layout`; `/login` is wrapped by an `Authenticated` group that redirects signed-in users away.
- Routes: `/` dashboard; `/products`, `/products/create`, `/products/edit/:id`, `/products/show/:id`;
  `/categories` + create/edit/show; `/orders`, `/orders/show/:id`; `/users`,
  `/users/admins`, `/users/customers`, `/users/create`, `/users/edit/:id`, `/users/show/:id`;
  `/settings/payments`, `/settings/store`; `*` → `ErrorComponent`.
- Refine resource/metadata definitions live in `src/lib/Resources.tsx`.
- Devtools (`@refinedev/devtools`) are imported unconditionally and ship in the production bundle.
  They bind port 5001 by default; set `REFINE_DEVTOOLS_PORT` when running both dashboards.

## Auth and token storage

- `src/providers/auth.ts` is a custom `authProvider`. Login calls `authApi.loginTenant` and stores the
  session; logout clears storage and returns to `/login`.
- Token storage keys (`src/api/constants.ts`) are load-bearing — never rename them:
  `tenant-access-token`, `tenant-email`, `tenant-refresh-token`. All live in `localStorage` via
  `tokenStorage` in `src/api/client.ts`; there is no `sessionStorage`.
- `check` decodes the access JWT (must be `type: access` or absent, numeric `exp` in the future) and
  compares the host tenant to the JWT tenant claim. On an invalid access token with a refresh token
  present it calls the single-flight `refreshSession`.
- Refresh (`POST auth/refresh` with `{ refresh_token }` + `x-tenant-slug`) is single-flight. A
  401/403 from refresh clears tokens (definitive); a transient error keeps them.
- The frontend is single-role and has no route RBAC; the API is the security boundary.
  `src/constants/users.ts` exposes rank helpers only for UX.

## API client

- `src/api/client.ts` exports one `apiClient` (`axios.create({ baseURL: VITE_API_URL })`).
  - Request interceptor: sets `x-tenant-slug`; attaches `Authorization: Bearer <access>` when present.
  - Response interceptor: on 401 for a non-auth endpoint, retries once after a single-flight refresh;
    redirects to `/login` only when the refresh token is gone.
  - `toApiError` normalizes axios errors and joins array `message` values.
- Endpoint modules: `auth.api.ts`, `products.api.ts` (image upload/delete/reorder), `orders.api.ts`,
  `payments.api.ts` (Stripe account/connect), `dashboard.api.ts`, `currency.api.ts`.
- `VITE_API_URL` defaults to `http://localhost:4000/api/v1`.

## Data provider and list contract

- `src/providers/data.ts` is a custom `DataProvider` over `apiClient` (not `simple-rest`).
  `getList` expects `{ data, total }` from the API and otherwise processes a plain array client-side.
- `src/api/query-utils.ts` builds `page`/`limit`/`sortBy`/`sortOrder`, provides client-side
  filter/sort/pagination fallbacks, and honors `meta.detailPath` for detail routes. Unsupported
  filter operators throw by design.
- `users` `getOne` must pass `meta.detailPath: "users/profile"`; without it the provider hits
  `users/:id` and 404s.

## UI, forms, state

- Components: shadcn/ui primitives in `src/components/ui/*`, plus a vendored Refine UI kit in
  `src/components/refine-ui/**` (layout, views, data-table, form, theme, notification). Edits there
  are local, not npm-managed.
- Layout: `SidebarProvider` + `Sidebar` + `SidebarInset` + `Header`; theme toggle and user menu in the
  header.
- Theming: custom `ThemeProvider` (`refine-ui/theme/theme-provider.tsx`), default dark, persists to
  `refine-ui-theme`. Tailwind v4 is CSS-first (`src/App.css` has `@import "tailwindcss"` and oklch
  tokens); there is no `tailwind.config.*`.
- State is Refine core plus React context/local state. Toasts use `sonner`.
- Forms use `react-hook-form` + `zod` + `@hookform/resolvers`; schemas live next to the components.

## Tests

- `vitest.config.ts`: `environment: "jsdom"`, `include: ["src/**/*.test.{ts,tsx}"]`, alias `@`.
  No setup file. Ten test files cover auth, constants, utils, api helpers, and form schemas.

## Environment

Only `VITE_API_URL` is read (`src/api/constants.ts`). Copy `.env.example` to `.env`; the value is
inlined at build time, so change it before building.

## Docker

`Dockerfile` builds from the repository root context:
`docker build -f apps/store_owner_dashboard/Dockerfile .`. It installs the workspace, inlines the
`VITE_API_URL` build arg, runs `pnpm --filter tenant_dash build`, and serves `dist` with `serve` on
`${PORT:-3000}`. Changing `VITE_API_URL` requires a rebuild.

## Pitfalls

- `tsconfig.json` enables `strict`, `noUnusedLocals`, and `noUnusedParameters`; unused imports fail
  `typecheck` and `build`. `tsconfig.node.json` is orphaned, so `vite.config.ts` is not type-checked.
- `src/components/refine-ui/form/sign-in-form.tsx` hard-codes default credentials
  (`owner@example.com` / `12345678`) — treat as source truth, not a clean example.
- Do not rename the package (`tenant_dash`) or the `localStorage` keys; Docker and Turborepo filters
  and saved sessions depend on them.
