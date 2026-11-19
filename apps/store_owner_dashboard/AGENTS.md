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
- `src/api/client.ts` sets `x-tenant-slug` from the first host label with no `localhost`
  special case, so a bare `localhost` sends `x-tenant-slug: localhost`.
- `src/providers/auth.ts` cross-checks the host slug against the JWT's tenant claim as a UX guard
  (skipped when the slug is `null`).

Always develop against a tenant subdomain so both paths agree.

### Apex `?tenant=` mode

The storefront's apex fallback is mirrored here. It is a **client-only** SPA (no server, no proxy,
no middleware), so the tenant is resolved in the browser and attached by `apiClient`.

- Gated by the build-time flag `VITE_ALLOW_SUBDOMAIN` (`allowSubdomain()`; only the literal string
  `"false"` turns subdomain mode off). Unset/empty/`true` keeps today's subdomain behavior
  byte-identical and ignores `?tenant=` and persistence entirely.
- When the flag is off, `VITE_APP_ROOT_DOMAIN` (default `localhost`) classifies the host:
  `<label>.<root>` is a tenant, `<root>`/`www.<root>` is the apex, anything else yields no tenant.
- Precedence in param mode: host label, then a valid `?tenant=<slug>`, then the per-tab
  `sessionStorage` key `tenant-slug` (persisted on read, kept across logout). Only a syntactically
  valid slug counts (`isValidTenantSlug`). A newly seen valid param overwrites the stored slug.
- Two entry points: `getTenantHeaderSlug()` (for `apiClient`; flag ON = first host label) and
  `getGuardTenantSlug()` (for `authProvider`; flag ON = strict `getTenantSlug()`). They intentionally
  differ so flag-ON behavior is unchanged.
- The tenant stays in the URL: `TenantParamSync` calls `ensureTenantParamInUrl()` on every route
  change, re-appending `?tenant=<slug>` (merging existing query/hash). Refine's own navigation
  (`useLink`, `NavigateToResource`, button components) drops the param, so the param is re-appended
  rather than threaded through every link.
- When no tenant resolves, no `x-tenant-slug` is sent and the API returns its clear
  `Tenant not resolvable` 400; errors surface rather than redirecting to the API URL.
- Known limitation: token keys stay in `localStorage`, so on a shared apex origin two tabs with
  different `?tenant=` values share one token set; the JWT guard clears the session on mismatch.
  The keys are load-bearing and must not be renamed or namespaced.

## Layout and routing

- Entry is `src/index.tsx` (`index.html` loads `/src/index.tsx`); `src/App.tsx` wires
  `BrowserRouter → RefineKbarProvider → ThemeProvider → DevtoolsProvider → Refine`.
- Routing is React Router v7 `<Routes>`, not resource-driven. Auth-gated routes render inside
  `Layout`; the public auth routes (`/login`, `/verify-email`, `/forgot-password`,
  `/reset-password`) are wrapped by an `Authenticated` group that redirects signed-in users away.
- Routes: `/` dashboard; `/products`, `/products/create`, `/products/edit/:id`, `/products/show/:id`;
  `/categories` + create/edit/show; `/orders`, `/orders/show/:id`; `/users`,
  `/users/admins`, `/users/customers`, `/users/create`, `/users/edit/:id`, `/users/show/:id`;
  `/settings/payments`, `/settings/store`, `/settings/subscription`; public `/login`, `/verify-email`, `/forgot-password`,
  `/reset-password`; `*` → `ErrorComponent`.
- Refine resource/metadata definitions live in `src/lib/Resources.tsx`.
- Devtools (`@refinedev/devtools`) are imported unconditionally and ship in the production bundle.
  They bind port 5001 by default; set `REFINE_DEVTOOLS_PORT` when running both dashboards.

## Auth and token storage

- `src/providers/auth.ts` is a custom `authProvider`. Login calls `authApi.loginTenant` and stores the
  session; logout clears storage and returns to `/login`.
- Token storage keys (`src/api/constants.ts`) are load-bearing — never rename them:
  `tenant-access-token`, `tenant-email`, `tenant-refresh-token`. All live in `localStorage` via
  `tokenStorage` in `src/api/client.ts`. Pending email verification is separate and uses the
  per-tab `sessionStorage` key `email-verification-context`.
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
  `payments.api.ts` (Stripe account/connect), `dashboard.api.ts`, `currency.api.ts`, `otp.api.ts`,
  `subscriptions.api.ts` (subscription/plans/usage reads plus `createPaymentIntent`).
- `VITE_API_URL` defaults to `http://localhost:4000/api/v1`.

## Subscription

`/settings/subscription` (`src/pages/settings/subscription/index.tsx`) shows the current plan/usage
plus an "Available plans" tab set with a Monthly/Yearly toggle. Reads `GET subscription`,
`GET subscription/plans`, and `GET subscription/usage` via `src/api/subscriptions.api.ts`.

Self-serve checkout is **enabled** via Stripe Elements (re-introducing the purchase path):

- Each non-current, billable plan tab (`monthlyPrice > 0 || yearlyPrice > 0`) renders an **Upgrade**
  button that opens `PlanCheckoutDialog.tsx`; the current plan and free/non-billable plans keep a
  disabled button. The upgrade uses the page's selected Monthly/Yearly interval.
- `PlanCheckoutDialog` calls `subscriptionsApi.createPaymentIntent(planId, billingInterval)` →
  `POST payments/stripe/subscription` (returns `{ clientSecret }`), then renders `Elements` +
  `PaymentElement` and calls `stripe.confirmPayment({ redirect: "if_required" })`. The API creates a
  `PENDING` `SubscriptionPayment`; only the `payment_intent.succeeded` webhook assigns the plan, so
  the dialog does **not** optimistically update anything.
- `createPaymentIntent` dedupes concurrent requests per `(planId, billingInterval)` with an in-flight
  `Map` (mirroring the storefront's `CreateStripePayment`), so React StrictMode's double-invoked mount
  effect creates a single `PENDING` row.
- Completion is **polled**: after `confirmPayment` returns without error, `index.tsx` sets
  `pendingPlanId` and polls `GET subscription` (~2s, 30s cap) until `subscription.planId` matches,
  then refreshes subscription + usage and toasts; on timeout it shows "Payment is still processing —
  refresh in a moment" and stops.
- 3DS/redirect returns land on `/settings/subscription?stripe=return&plan=<id>`; on mount a
  `redirect_status` of `succeeded`/`processing`/`requires_action` starts the same poll, a failure
  value toasts, and Stripe's `stripe`/`plan`/`redirect_status`/`payment_intent*` params are stripped
  via `replaceState`.
- The Upgrade button is shown to **any** signed-in user (no client role gate); the API's
  `subscriptions:manage` (STORE_OWNER only) returns `403` for an ADMIN and the dialog surfaces it.
  Errors (`SUBSCRIPTION_NOT_FOUND`, `PLAN_INACTIVE`, `PLAN_NOT_PUBLIC`, `PLAN_NOT_PURCHASABLE`, 403)
  render inline with a Retry.
- Requires `VITE_STRIPE_PUBLISHABLE_KEY` (build-time, inlined); when unset `src/lib/stripe.ts` exports
  `stripePromise = null` and the dialog shows "Payments are not configured for this store."
- Self-serve **cancel + refund** is enabled. The current-plan card renders a destructive
  "Cancel subscription & request refund" button plus a muted "Refund available until {date}" line
  **only** when `subscription.refundEligible` is true (`GET subscription` now returns the additive
  `refundEligible`/`refundDeadline` fields). The button opens `CancelSubscriptionDialog.tsx`, which
  states the action is irreversible, refunds the latest payment in full, and drops the store to the
  Free plan after Stripe confirms the refund. Confirm (`variant="destructive"`) calls
  `subscriptionsApi.cancelSubscription()` → `POST payments/stripe/subscription/cancel`. The API
  returns `{ subscription, refundStatus }`; `PENDING`/`PROCESSING` shows a pending toast instead of
  claiming an immediate downgrade. `refetchAll()` reloads the page. Errors (`SUBSCRIPTION_NOT_REFUNDABLE`, `REFUND_WINDOW_EXPIRED`,
  `SUBSCRIPTION_NOT_FOUND`, `403` for an ADMIN) render inline with the dialog left open. The button
  is shown to any signed-in user; the API is the gate. Resume / re-subscribe remains **out of scope**
  (no API). Other plan changes are made by the platform (Super Admin).

- The current-plan card shows the plan, billing interval, price, current period, and trial window. It
  no longer reads `stripeSubscriptionId`/`cancelAtPeriodEnd` (those fields were removed).

## Email verification and password reset

- `src/api/otp.api.ts` wraps the tenant-scoped OTP routes: `requestOtp(email, purpose)` →
  `POST auth/email-otp/request`, `verifyEmailOtp(email, code)` → `POST auth/email-otp/verify`
  (`EMAIL_VERIFICATION`), and `confirmPasswordReset(email, code, newPassword)` →
  `POST auth/password-reset/confirm`. `x-tenant-slug` is attached by `apiClient`; OTP request
  responses include the configured `resendCooldownSeconds` on every generic response path.
- `authProvider.login` treats an unverified email as a redirect: a successful login with
  `verified === false`, or a `401 { code: 'EMAIL_NOT_VERIFIED' }`, returns
  `{ success: true, redirectTo: '/verify-email' }` and stores **no** session. Before redirecting it
  saves the tenant-bound email in `src/lib/verification-context.ts`; the per-tab context never puts
  the email in the URL and is cleared after a verified login or successful verification.
- Pages `VerifyEmail`, `ForgotPassword`, `ResetPassword` (forms in
  `src/components/refine-ui/form/`) are public; the sign-in form links to `/forgot-password`. The
  code is entered with the vendored `input-otp` component (`src/components/ui/input-otp.tsx`,
  `input-otp` dependency), shared via `otp-field.tsx`. Resend timing uses the absolute deadline in
  the verification context and the cooldown returned by the API, so reloads and background tabs do
  not drift. Password-reset URL behavior is unchanged.
- `ApiError` (`src/api/client.ts`) now carries the optional `code` from `{ code, message }` bodies;
  OTP/password-reset routes are in `AUTH_ENDPOINTS` so their `401`s never trigger a token refresh.

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

`VITE_API_URL` is read in `src/api/constants.ts`; `VITE_ALLOW_SUBDOMAIN` and `VITE_APP_ROOT_DOMAIN`
are read in `src/api/tenant.ts` at call time; `VITE_STRIPE_PUBLISHABLE_KEY` is read in
`src/lib/stripe.ts` at module load. Copy `.env.example` to `.env`; all values are inlined at build
time, so change them before building.

## Pitfalls

- `tsconfig.json` enables `strict`, `noUnusedLocals`, and `noUnusedParameters`; unused imports fail
  `typecheck` and `build`. `tsconfig.node.json` is orphaned, so `vite.config.ts` is not type-checked.
- `src/components/refine-ui/form/sign-in-form.tsx` hard-codes default credentials
  (`owner@example.com` / `12345678`) — treat as source truth, not a clean example.
- Do not rename the package (`tenant_dash`) or the `localStorage` keys; Turborepo filters and saved
  sessions depend on them.
