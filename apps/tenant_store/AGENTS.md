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

- The entrypoint is `src/proxy.ts` (Next 16 renamed `middleware.ts` to `proxy.ts`). Adding a
  `src/middleware.ts` would conflict — keep the logic in `src/proxy.ts`.
- The tenant slug is the first label of the raw `Host` (`req.headers.get("host").split(".")[0]`).
  `NEXT_PUBLIC_APP_ROOT_DOMAIN` is declared in env files but **not read in code**, so there is no
  root-domain stripping. `x-tenant-slug` is attached per request by the axios interceptor in
  `src/api/apiClient.ts`, not by the proxy.
- The proxy rewrites to `/404` when the host has no first label. A bare `localhost` or `127.0.0.1`
  still has a truthy first label (`localhost`, `127`), so the neutral 404 does not trigger for those
  hosts. Verify behavior against a real subdomain (`my-store.localhost:3000`).
- Public paths pass through without auth: `/`, `/login`, `/register`, `/products`, `/api/refresh`,
  and any `/products/*`. Everything else first attempts `refreshSession()`; if it rotates the cookie
  it forwards the httpOnly cookie, otherwise it delegates to NextAuth `withAuth`.

## Routing

Server components unless noted.

- `src/app/layout.tsx` — async root layout; fetches store info (`getStoreInfo`), wraps `Providers` +
  `CurrencyProvider`, `NavBar`, `Toaster`. Dark mode is hardcoded on `<html>`; there is no toggle.
- Pages: `/` (Home, `"use client"`), `/login`, `/register`, `/products`, `/products/[productId]`
  (numeric id, `Number(productId)`), `/cart`, `/orders`, `/404/page.tsx` (rewrite target that calls
  `notFound()`), and `not-found.tsx`.
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
  `__Secure-` when `NEXTAUTH_URL` is https). Cookie options, chunked-cookie cleanup, and the 30-day
  max age are duplicated in `src/proxy.ts` and `src/app/api/refresh/route.ts`; keep them in sync.
- Refresh is rotation-sensitive (the API rotates `jti`), so exactly one refresh may run at a time.
  There are two paths: proxy refresh before render, and browser single-flight `POST /api/refresh`.
- `apiClient` is isomorphic. Server usage calls `getServerSession` + `next/headers`; browser usage
  calls `getSession` + `window.location.hostname`. The cookie dependency makes catalog pages render
  dynamically, not ISR-cached.

## API client and data fetching

- `src/api/apiClient.ts` is an axios instance with `baseURL: NEXT_PUBLIC_BACKEND_URL`. The request
  interceptor attaches `Authorization: Bearer <accessToken>` and `x-tenant-slug`. A 401 on a browser
  request triggers a single-flight `/api/refresh` and one retry; server 401s reject.
- Browser code talks to the backend **directly**; there is no Next route-handler proxy holding JWTs.
  `src/lib/api.ts`, `src/lib/client-api.ts`, and `src/lib/session.ts` do not exist.
- `src/lib/tenant.ts` `getStoreInfo()` is the only fetch with a cache setting
  (`next: { revalidate: 60 }`). There are no cache tags, no `export const revalidate`, and no
  `export const dynamic`.
- API modules: `src/api/productsApi.ts`, `cartApi.ts`, `orderApi.ts`, `addressesApi.ts`,
  `paymentsApi.ts`, `authApi.ts`.

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
  `/auth/register` then routes to `/login`; logout posts `/auth/logout` then `signOut`.

## UI and styling

- Components: shadcn/ui in `src/components/ui/*`. `components.json` uses style `base-rhea`,
  base color `mist`, icon library `remixicon`, RSC true. Primitives import from `@base-ui/react/*`
  (**not** Radix); Base UI's `render={<Button/>}` trigger pattern is used in dialogs.
- Tailwind v4 is CSS-first (`src/app/globals.css` with `@import "tailwindcss"` and `@theme inline`
  tokens); there is no `tailwind.config.*`. `cn()` is `twMerge(clsx(...))` in `src/lib/utils.ts`.
- `pagination.tsx` and `tooltip.tsx` are unused so far.

## Environment

Referenced in code: `NEXTAUTH_URL`, `NEXTAUTH_SECRET`, `NEXT_PUBLIC_BACKEND_URL`,
`NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, and `NEXT_STANDALONE` (build-time).
Declared in `.env.example` but **unused in code**: `NEXT_PUBLIC_APP_ROOT_DOMAIN`, `R2_PUBLIC_URL`.

`next.config.ts` hardcodes `images.remotePatterns` for `images.unsplash.com`, `cdn.pixabay.com`, and
an `r2.dev` host; there is no dynamic `R2_PUBLIC_URL` wiring, so a custom CDN host needs a code
change.

## Docker

`Dockerfile` builds from the repository root context:
`docker build -f apps/tenant_store/Dockerfile .`. It uses Node 22, installs the workspace, passes
`NEXT_PUBLIC_BACKEND_URL`, `NEXT_PUBLIC_APP_ROOT_DOMAIN`, and `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
as build args, sets `NEXT_STANDALONE=1`, and runs the standalone server
(`node apps/tenant_store/server.js`) on port 3000.

`output: "standalone"` is enabled only when `NEXT_STANDALONE=1`; local `next build` skips it because
tracing the pnpm store creates symlinks Windows dev machines reject. Never set `NEXT_STANDALONE=1`
for a local Windows build.

## Pitfalls

- Do not add `src/middleware.ts`; Next 16 uses `src/proxy.ts` here.
- `VITE_*` does not apply here; this app reads `NEXT_PUBLIC_*` and is rebuilt when those change.
- `src/app/page.tsx` contains a leftover debug button that calls `apiClient.get("/products")` and
  logs the result; several `catch {}` blocks swallow errors.
- There is no slug-based product route and no ISR-cached catalog; do not reintroduce those
  assumptions from older docs.
- Secrets hygiene: `.env.local` holds a live-looking `NEXTAUTH_SECRET` and a Stripe test key.
  `.gitignore` does not currently cover `.env.production.local`, which exists as a placeholder file.
