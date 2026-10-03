# AGENTS.md — apps/super_admin_dashboard (`super_admin_dash`)

Platform (super admin) console for tenant provisioning, tenant lifecycle, platform payments, and
currency requests. Refine v5 + Vite 6 + React 19 + React Router 7 + axios, Tailwind v4, shadcn/ui
(style `new-york`, base color `neutral`), Radix primitives.

The root `AGENTS.md` covers cross-app contracts. This file is authoritative for this app.

## Commands

Run from the repository root with a filter, or from the app directory.

- `pnpm --filter super_admin_dash dev` — `refine dev` on **port 5173** (`strictPort`).
- `pnpm --filter super_admin_dash build` — `tsc && refine build`.
- `pnpm --filter super_admin_dash typecheck` — `tsc --noEmit`.
- `pnpm --filter super_admin_dash lint` — `eslint .` (flat config, no Prettier).
- `pnpm --filter super_admin_dash start` — `refine start`.

There is **no `test` task** and no test runner or test files. Do not add one; Turborepo skips
packages without the script and the app was intentionally not set up for tests.

## Platform scope

This console is **not tenant-scoped**. It never sends `x-tenant-slug`; it authenticates as a
platform super admin and calls only `platform/*` endpoints with `Authorization: Bearer <access>`.
The tenant-scoped console is `apps/store_owner_dashboard`.

## Layout and routing

- Entry is `src/index.tsx` (`index.html` loads `/src/index.tsx`); `src/App.tsx` wires
  `BrowserRouter → ErrorBoundary → RefineKbarProvider → ThemeProvider → DevtoolsProvider → Refine`.
- Routing is React Router v7 `<Routes>`. Auth-gated routes render inside `Layout`; `/login` is
  wrapped by an `Authenticated` group that redirects signed-in users to `platform/tenants`.
- Routes: `/` dashboard; `/tenants`, `/tenants/create`, `/tenants/show/:id`; `/payments`,
  `/payments/show/:id`; `/currency-requests`; `/subscription-plans`,
  `/subscription-plans/create`, `/subscription-plans/edit/:id`; `/login`; `*` → `ErrorComponent`.
- Refine resources in `src/lib/Resources.tsx`: `dashboard`, `platform/tenants`,
  `platform/payments`, `platform/currency-requests`, `platform/subscription-plans`. The sidebar is
  generated from `useMenu()`.
- `syncWithLocation: true` is set globally and on the list views, so list state lives in the URL.
- Devtools (`@refinedev/devtools`) are imported unconditionally and ship in the production bundle.
  They bind port 5001 by default; set `REFINE_DEVTOOLS_PORT` when running both dashboards.

## Auth and token storage

- `src/providers/auth.ts` is a custom `authProvider`. Login calls `authApi.loginPlatform`; logout
  clears storage and returns to `/login`.
- Token storage keys (`src/api/constants.ts`) are load-bearing — never rename them:
  `saas-admin-access-token`, `saas-admin-email`, `saas-admin-refresh-token`. They live in
  `localStorage` via `tokenStorage` in `src/api/client.ts`.
- `check` decodes the access JWT (must be `type: access` or absent, numeric `exp` in the future); on
  an invalid access token with a refresh token present it calls the single-flight `refreshSession`.
  A definitive 401/403 from refresh clears tokens; a transient error keeps them.
- Sign-in labels in `src/components/refine-ui/form/sign-in-form.tsx` ("Sign in",
  "Super admin platform access" description, `admin@example.com` placeholder, "saas_store platform"
  footer) are part of the byte-identical surface — do not reword them.
- `getPermissions` returns the JWT `role` claim.

## API client

- `src/api/client.ts` exports one `apiClient` (`axios.create({ baseURL: VITE_API_URL })`).
  - Request interceptor: attaches `Authorization: Bearer <access>` when present. No tenant header.
  - Response interceptor: on 401 for a non-auth endpoint, retries once after a single-flight refresh;
    redirects to `/login` only when the refresh token is gone.
  - `toApiError` normalizes axios errors and joins array `message` values.
- Endpoint modules: `auth.api.ts`, `tenants.api.ts`, `payments.api.ts`, `currency-requests.api.ts`.
- `VITE_API_URL` defaults to `http://localhost:4000/api/v1`.

### Endpoints used

- `POST auth/login/platform`, `POST auth/refresh`, `POST auth/register-store` (tenant creation).
- `GET platform/tenants`, `GET platform/tenants/:id`, `PATCH platform/tenants/:id/toggle-active`.
- `GET platform/payments`, `GET platform/payments/summary`, `GET platform/payments/:id`,
  `GET platform/payments/:id/charges`, `GET platform/payments/:id/payouts`,
  `PATCH platform/payments/:id/payments-paused`, `PATCH platform/payments/:id/payouts-paused`.
- `GET platform/currency-requests`, `PATCH platform/currency-requests/:id/approve`,
  `PATCH platform/currency-requests/:id/reject`.
- `GET|POST platform/subscription-plans`, `GET|PATCH|DELETE platform/subscription-plans/:id`
  (plan CRUD lives here), `GET platform/tenants/:id/subscription`,
  `GET platform/tenants/:id/subscription/usage`, `PUT platform/tenants/:id/subscription` (assign),
  `PATCH platform/tenants/:id/subscription/status`.

## Data provider

- `src/providers/data.ts` is a custom `DataProvider` over `apiClient`.
  - `getList`/`getOne` special-case `platform/tenants` through `tenantsApi`.
  - `create` special-cases `auth/register-store` through `tenantsApi.registerStore`.
  - Generic CRUD maps to `GET/POST/PATCH/DELETE resource[/:id]`; `custom` forwards `meta`, query,
    and headers.
  - Filtering/sorting/pagination are client-side over the full list (`src/api/query-utils.ts`,
    eq/ne/contains/in/nin/lt/lte/gt/gte/startswith/endswith/null/nnull).

## UI, forms, state

- Components: shadcn/ui primitives in `src/components/ui/*` (Radix-based), plus a vendored Refine UI
  kit in `src/components/refine-ui/**` (layout, views, data-table, form, theme, notification, error
  boundary).
- Layout: `ThemeProvider` → `SidebarProvider` → `Sidebar` + `SidebarInset` (`Header` + `main`).
  Header has a theme toggle and a user dropdown with logout.
- Theming: custom `ThemeProvider`, persists to `refine-ui-theme`. Tailwind v4 is CSS-first in
  `src/App.css` (emerald primary, oklch tokens); there is no `tailwind.config.*`.
- Toasts use `sonner` through the Refine notification provider. `recharts` is available for charts.
- Forms use `react-hook-form` + `zod` + `@hookform/resolvers`.

## Environment

Only `VITE_API_URL` is read (`src/api/constants.ts`). Copy `.env.example` to `.env`; the value is
inlined at build time, so change it before building.

## Docker

`Dockerfile` builds from the repository root context:
`docker build -f apps/super_admin_dashboard/Dockerfile .`. It installs the workspace, inlines the
`VITE_API_URL` build arg, runs `pnpm --filter super_admin_dash build`, and serves `dist` with
`serve` on `${PORT:-3000}`. Changing `VITE_API_URL` requires a rebuild.

## Pitfalls

- `tsconfig.json` enables `strict` and `noUnusedParameters`; unused imports fail `typecheck` and
  `build`.
- `authProvider.getIdentity` returns `{ id, name, roles }`, but `UserAvatar`/`UserInfo` expect
  `{ firstName, lastName, fullName, ... }`. Avatar initials and identity text render blank until that
  shape is aligned.
- The mounted `Toaster` comes from `refine-ui/notification/toaster.tsx` and reads the app's custom
  theme provider. `src/components/ui/sonner.tsx` uses `next-themes`; do not swap the mounted Toaster
  to it without a `next-themes` provider.
- Unused boilerplate: `@refinedev/rest`, `@refinedev/simple-rest`, `@refinedev/react-hook-form`,
  `sign-up-form.tsx`, `forgot-password-form.tsx`, and `edit-view.tsx` are declared/present but not
  wired. Do not wire them up unless intended.
- Do not rename the package (`super_admin_dash`) or the `localStorage` keys; Docker and Turborepo
  filters and saved admin sessions depend on them.
