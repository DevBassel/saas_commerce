# AGENTS.md — apps/tenant_store (`tenant_store`)

Public, SEO-oriented customer storefront. Next.js 16 App Router + React 19 + NextAuth v4 +
Tailwind v4 + shadcn/ui (`base-rhea` style over Base UI primitives) + Stripe.

The root `AGENTS.md` covers cross-app contracts. This file is authoritative for this app.

## Commands

Run from the repository root with a filter, or from the app directory.

- `pnpm --filter tenant_store dev` — `next dev` on **port 3000**.
- `pnpm --filter tenant_store build` — `next build`.
- `pnpm --filter tenant_store start` — `next start` on port 3000.
- `pnpm --filter tenant_store lint` — `eslint` (auto-discovers `eslint.config.mjs`).
- `pnpm --filter tenant_store typecheck` — `tsc --noEmit`.

There is **no `test` task** and no test runner or test files. Do not add one.

## Tenant resolution

- Host classification has a single source of truth: `src/lib/tenant/host.ts`
  (`classifyHost`, `normalizeRootDomain`, `getAppRootDomain`, `getTenantSlugFromHost`,
  `isValidTenantSlug`, `allowSubdomain`, `getTenantSlugFromParam`, `resolveTenantSlug`). It is pure
  and edge-safe. `src/lib/tenant/slug.ts` is a back-compat re-export of `getTenantSlugFromHost`;
  import from `host.ts` for new code.
- Tenant resolution has two modes, gated by the build-time `NEXT_PUBLIC_ALLOW_SUBDOMAIN` flag
  (`allowSubdomain()`; only the literal string `"false"` turns subdomain mode off). A tenant
  subdomain host always wins in either mode. When the flag is off it also accepts `?tenant=<slug>`
  on the platform apex; a value that fails `isValidTenantSlug` (or is absent) is the platform
  context, and a valid-but-unknown slug becomes a tenant 404 via `loadStoreInfo`. When the flag is
  on, `?tenant=` is ignored entirely (today's behavior, unchanged).
- The proxy is also the only place that sets the tenant signal: it strips any client-sent
  `x-tenant-slug`, then sets it for tenant contexts (host subdomain or apex `?tenant=`) and deletes
  it for platform/invalid ones, forwarding the request headers via `NextResponse.next/rewrite({request})`.
  Server code (`loadStoreInfo`, `apiClient`) reads that trusted header and falls back to the host.
- In `?tenant=` mode the tenant stays in the URL: server components use `getTenantParam()`
  (`src/lib/tenant/index.ts`) + `withTenantParam()` (`src/lib/tenant/url.ts`); client components use
  `TenantLink` / `useTenantRouter` / `useTenantParam` (`src/lib/tenant/nav.tsx`), fed by the
  `TenantSlugProvider` the tenant layout mounts from the trusted header. Platform-group links are
  intentionally left untouched.
- Classification is root-domain aware. `NEXT_PUBLIC_APP_ROOT_DOMAIN` (default `localhost`) is the
  apex: the root and `www.<root>` are the **platform** context, `<label>.<root>` is a **tenant**
  context (slug = the single label), and anything else (lookalikes such as
  `nike.<root>.evil.com`, deeper subdomains, or `127.0.0.1`) is **invalid**. This is why the apex can
  no longer collide with a tenant named like the root's first label.
- The entrypoint is `src/proxy.ts` (Next 16 renamed `middleware.ts` to `proxy.ts`). Adding a
  `src/middleware.ts` would conflict — keep the logic in `src/proxy.ts`.
- The proxy branches on `resolveTenantSlug` (host first, then apex `?tenant=` when the flag is off):
  invalid host rewrites to `/404`; a resolved slug serves the storefront and redirects platform-only
  paths to `/`; no slug on the platform host serves `/`, `/home`, `/plans`, `/register-store` and
  redirects tenant-only paths to `/`. Tenant public paths pass without auth (`/`, `/login`,
  `/register`, `/verify-email`, `/forgot-password`, `/reset-password`, `/products`, `/api/refresh`,
  `/products/*`); everything else keeps the refresh-then-session protection (a bare `getToken`
  check that redirects to `/login?callbackUrl=…`, replacing the old `withAuth` middleware).
- Context is decided by host and (in param mode) the validated `?tenant=` parameter, never by path;
  `x-tenant-slug` is attached to tenant requests only and deleted for platform/invalid hosts.
- A host whose label does not resolve to a tenant is a hard 404: the tenant layout calls `notFound()`
  when `loadStoreInfo()` reports the backend returned 404 for `GET /store/info`.


## Routing

Server components unless noted. Two route groups carry two root layouts (each owning
`<html>`/`<body>`); there is **no** top-level `src/app/layout.tsx`.

- `src/app/(tenant)/layout.tsx` — storefront shell. Fetches store info (`loadStoreInfo`) and calls
  `notFound()` for an unknown tenant, wraps `Providers` + `TenantSlugProvider` (the trusted tenant
  slug for client navigation) + `CurrencyProvider`, `NavBar`, `Toaster`, and exports
  `generateMetadata` (store name/description, `metadataBase` from the request host). Dark mode is
  hardcoded on `<html>`; there is no toggle.
- `src/app/(platform)/layout.tsx` — platform shell (apex). Static: it never calls `headers()` or
  `loadStoreInfo`; it has its own nav and `Toaster` (no storefront `NavBar`).
- Tenant pages under `src/app/(tenant)/`: `/` (Home, server component), `/login`, `/register`,
  `/verify-email`, `/forgot-password`, `/reset-password`, `/products`, `/products/[productId]`
  (numeric id, `Number(productId)`; calls `notFound()` and exports `generateMetadata`), `/cart`,
  `/orders`.
- Platform pages under `src/app/(platform)/`: `/home` (the apex `/` is rewritten here by the proxy;
  the URL stays `/`), `/plans` (reads the public `GET /platform/subscription-plans` via
  `src/api/plansApi.ts`; human formatting in `src/lib/platform/plans.ts`), `/register-store`
  (tenant-less `POST /auth/register-store`), and `404/page.tsx` (rewrite target for invalid hosts
  that calls `notFound()`).
- Shared `src/app/not-found.tsx` is context-aware (platform vs tenant vs invalid), preferring the
  trusted `x-tenant-slug` header over the host classification for the tenant branch (so an apex
  `?tenant=` miss is still a tenant 404) and wraps `/404/page.tsx` and the tenant layout's
  `notFound()`.
- Every tenant data route has `loading.tsx`/`error.tsx` boundaries backed by
  `src/components/shared/` (`RouteLoading`, `RouteError`, `Pagination`).
- Route handlers: only `src/app/api/refresh/route.ts` (`POST`) and
  `src/app/api/auth/[...nextauth]/route.ts` (`GET`, `POST`).
- There is no `/check-out` page, no server actions, and no `src/hooks/`.

Product detail pages resolve by **numeric id**, not slug. `IProduct.slug` exists in the API types but
is never used for routing or fetching here.

## Auth and session

- `src/lib/auth.ts` defines NextAuth v4 (JWT strategy, `pages.signIn: "/login"`) with a Credentials
  provider whose `authorize` posts to `${NEXT_PUBLIC_BACKEND_URL}/auth/login` through `apiClient`
  (so `x-tenant-slug` is attached).
- JWTs live encrypted in the httpOnly NextAuth session cookie (`next-auth.session-token`, or
  `__Secure-` when `NEXTAUTH_URL` is https). The cookie name, options, and the 30-day max age live
  in one module (`src/lib/auth/session-cookie.ts`) imported by `src/proxy.ts` and
  `src/app/api/refresh/route.ts`.
- The refresh token is **not** placed on the client session (only `session.user.accessToken` is);
  it stays in the httpOnly cookie read by `getToken`. Refresh is rotation-sensitive (the API rotates
  `jti`), so exactly one refresh may run at a time.
- Shared rotation logic lives in `src/lib/auth/refresh.ts` (`requestTokenRotation`,
  `encodeRotatedSession`), used by both refresh paths: the proxy before render, and the browser
  single-flight `POST /api/refresh`. This shares the contract but does not lock the two runtimes
  (edge proxy vs Node route); keep the "server never refreshes mid-render" invariant.
- A **failed** refresh signs the user out rather than failing open. When the proxy attempts a
  rotation for an expired access token and it does not succeed, it clears the session cookie and
  redirects to `/login?callbackUrl=…`. The browser interceptor already calls `signOut` when
  `/api/refresh` returns 401.
- `apiClient` is isomorphic. Server usage calls `getServerSession` + `next/headers`; browser usage
  calls `getSession` + `window.location`. Both derive the tenant from the trusted `x-tenant-slug`
  header (server) or the host label with the `?tenant=` fallback when the flag is off (browser); the
  browser single-flight `POST /api/refresh` carries the tenant parameter so it is never mistaken for
  a platform request. The cookie dependency makes catalog pages render dynamically, not ISR-cached.
- NextAuth's `/api/auth/*` routes are **excluded from the proxy matcher**, so `authorize` (credentials
  login) never sees an `x-tenant-slug` header — in `?tenant=` mode the host is the apex and there is
  no host slug either. The login form therefore passes the resolved tenant as a `tenant` credential
  and `authorize` sets the header explicitly (`src/lib/auth.ts`); without it the backend rejects
  login with `400 Tenant not resolvable`. Empty in subdomain mode, where the host resolves it.

## API client and data fetching

- `src/api/apiClient.ts` is an axios instance with `baseURL: NEXT_PUBLIC_BACKEND_URL`. The request
  interceptor attaches `Authorization: Bearer <accessToken>` and `x-tenant-slug`. A 401 on a browser
  request triggers a single-flight `/api/refresh` and one retry; server 401s reject.
- Browser code talks to the backend **directly**; there is no Next route-handler proxy holding JWTs.
  `src/lib/api.ts`, `src/lib/client-api.ts`, and `src/lib/session.ts` do not exist.
- `src/lib/tenant/index.ts` `loadStoreInfo()` is the only fetch with a cache setting: per-tenant
  `next: { revalidate: 60, tags: ["store", "store:<slug>"] }`, with the slug repeated in the URL
  (`?tenant=<slug>`) because the Next Data Cache key ignores the `x-tenant-slug` header. No route
  exports `revalidate` or `dynamic` yet.
- API modules: `src/api/productsApi.ts`, `cartApi.ts`, `orderApi.ts`, `addressesApi.ts`,
  `paymentsApi.ts`, `couponsApi.ts`, `authApi.ts`, `otpApi.ts`.

## Email OTP

- `src/api/otpApi.ts` wraps the tenant-scoped API routes: `requestOtp(email, purpose)` →
  `POST /auth/email-otp/request`, `verifyEmailOtp(email, code)` → `POST /auth/email-otp/verify`
  (`EMAIL_VERIFICATION`), and `confirmPasswordReset(email, code, newPassword)` →
  `POST /auth/password-reset/confirm`. `x-tenant-slug` is attached by `apiClient`; these routes are
  tenant-scoped, so they only work on a tenant subdomain.
- The code is entered with the shadcn/`input-otp` component (`src/components/ui/input-otp.tsx`,
  `input-otp` dependency); it has one slot per digit (6).
- Flows: `POST /auth/register` auto-sends a verification OTP, so `/register` routes to
  `/verify-email?email=…`; that page verifies or resends. `/forgot-password` requests a
  `PASSWORD_RESET` code and routes to `/reset-password?email=…`, which confirms it. All three pages
  are public in `src/proxy.ts`. Request endpoints always return 200 (anti-enumeration).
- `src/lib/auth.ts` `authorize` rethrows the backend error `code` (e.g. `EMAIL_NOT_VERIFIED`), and
  `/login` surfaces a verify link when it sees that code.

## Cart, checkout, payments, orders

- Cart: `GET/POST/PATCH/DELETE` on `/cart` and `/cart/items[/:productId]`. `UpdateCartItem` and
  `ClearCart` exist but are not wired to the UI.
- Checkout (`src/components/cart/PlaceOrder.tsx`): pick or create an address
  (`GET/POST /addresses`), then `POST /orders { addressId }`, then Stripe.
- Payments (`src/api/paymentsApi.ts`, `StripePaymentStep.tsx`): `POST /payments/stripe { orderId }`
  returns a `clientSecret`; `stripe.confirmPayment` uses
  `return_url: ${origin}/orders?payment=return` and `redirect: "if_required"`. When the publishable
  key is missing, `stripePromise` is null and the UI shows "Payments are not configured".
- Orders: `GET /orders`, `GET /orders/:id`, `PATCH /orders/:id/cancel` (owner may cancel `PENDING`
  or `CONFIRMED`), `PATCH /orders/:id/return` (only `DELIVERED`). `OrderPaymentWatcher.tsx` polls
  pending orders after `?payment=return`.
- Auth flows: login via `signIn("credentials", { redirect: false })`; register posts
  `/auth/register` then routes to `/verify-email`; logout posts `/auth/logout` then `signOut`.

## UI and styling

- Components: shadcn/ui in `src/components/ui/*`. `components.json` uses style `base-rhea`,
  base color `mist`, icon library `remixicon`, RSC true. Primitives import from `@base-ui/react/*`
  (**not** Radix); Base UI's `render={<Button/>}` trigger pattern is used in dialogs.
- Tailwind v4 is CSS-first (`src/app/globals.css` with `@import "tailwindcss"` and `@theme inline`
  tokens); there is no `tailwind.config.*`. `cn()` is `twMerge(clsx(...))` in `src/lib/utils.ts`.
- `pagination.tsx` and `tooltip.tsx` are unused so far.

## Environment

Referenced in code: `NEXTAUTH_URL`, `NEXTAUTH_SECRET`, `NEXT_PUBLIC_BACKEND_URL`,
`NEXT_PUBLIC_APP_ROOT_DOMAIN` (host classification; defaults to `localhost`, must be the real apex
in production), `NEXT_PUBLIC_ALLOW_SUBDOMAIN` (build-time tenant-resolution mode; unset/`true` =
subdomain, literal `false` = apex `?tenant=<slug>`), `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, and
`NEXT_STANDALONE` (build-time). Declared in `.env.example` but **unused in code**: `R2_PUBLIC_URL`.

`next.config.ts` hardcodes `images.remotePatterns` for `images.unsplash.com`, `cdn.pixabay.com`, and
an `r2.dev` host; there is no dynamic `R2_PUBLIC_URL` wiring, so a custom CDN host needs a code
change.

## Docker

`Dockerfile` builds from the repository root context:
`docker build -f apps/tenant_store/Dockerfile .`. It uses Node 22, installs the workspace, passes
`NEXT_PUBLIC_BACKEND_URL`, `NEXT_PUBLIC_APP_ROOT_DOMAIN`, `NEXT_PUBLIC_ALLOW_SUBDOMAIN`, and
`NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` as build args, sets `NEXT_STANDALONE=1`, and runs the
standalone server (`node apps/tenant_store/server.js`) on port 3000.

`output: "standalone"` is enabled only when `NEXT_STANDALONE=1`; local `next build` skips it because
tracing the pnpm store creates symlinks Windows dev machines reject. Never set `NEXT_STANDALONE=1`
for a local Windows build.

## Pitfalls

- Do not add `src/middleware.ts`; Next 16 uses `src/proxy.ts` here.
- `VITE_*` does not apply here; this app reads `NEXT_PUBLIC_*` and is rebuilt when those change.
- `src/api/handleError.ts` is pure (`ApiError`, `isApiError`, `toApiError`) and safe to import from
  Server Components. The client toast wrapper lives in `src/api/toastError.ts` and must only be
  imported from Client Components.
- There is no slug-based product route and no ISR-cached catalog; do not reintroduce those
  assumptions from older docs.
- In `?tenant=` mode only the product-detail canonical (`products/[productId]`) includes the tenant
  parameter; the storefront home and product list have no per-tenant canonical, so indexable URLs
  there are not tenant-distinct. Extend `generateMetadata` if that SEO treatment is needed.
- Secrets hygiene: `.env.local` holds a live-looking `NEXTAUTH_SECRET` and a Stripe test key.
  `.gitignore` does not currently cover `.env.production.local`, which exists as a placeholder file.
