# Active Context — saas_commerce

Current focus and recent changes. This file is **rewritten**, not appended, on every update.
Most dynamic file in the bank — keep it short and current.

## Current focus

**`apps/store_owner_dashboard` apex `?tenant=` mode** (plan:
`.kilo/plans/1791482971107-tenant-dash-query-param-tenant-mode.md`). Mirrors the storefront fallback
for the client-only Refine/Vite SPA: build-time `VITE_ALLOW_SUBDOMAIN` (default subdomain mode) plus
`VITE_APP_ROOT_DOMAIN`; when the flag is the literal `false`, the tenant is resolved in the browser
from the host, then `?tenant=<slug>`, then per-tab `sessionStorage`, and attached as
`x-tenant-slug`. Implemented and uncommitted; both build modes verified. The earlier storefront
`?tenant=` work and `apps/api` Email OTP work remain complete and unchanged.

## Recent changes

- 2026-10-08 — Store-owner dashboard `?tenant=` fallback (`apps/store_owner_dashboard`,
  uncommitted): new resolver/URL helpers in `src/api/tenant.ts` — `allowSubdomain()`,
  `getAppRootDomain()` (default `localhost`), `isValidTenantSlug`, `getTenantSlugFromHost`,
  `getTenantSlugFromParam`, `resolveTenantSlugFrom`, `getCurrentTenantSlug`, the two entry points
  `getTenantHeaderSlug()` (apiClient) / `getGuardTenantSlug()` (auth guard), `sessionStorage` key
  `tenant-slug`, `withTenantParam`, `ensureTenantParamInUrl`. `apiClient` now sends the header
  through `getTenantHeaderSlug()` and the `window.location.replace(API_URL)` null branch was removed
  (a null slug now sends no header; the API's `Tenant not resolvable` 400 surfaces). `authProvider`
  uses `getGuardTenantSlug()` and gates `withTenant(...)` on `!allowSubdomain()` so flag-ON
  redirects stay byte-identical; tenant param is re-appended there in param mode. New
  `src/components/TenantParamSync.tsx` calls `ensureTenantParamInUrl()` on every route change,
  mounted inside `<BrowserRouter>` in `App.tsx`. Env plumbing: `.env.example`, `Dockerfile` build
  args, app + root `AGENTS.md`. Verified: typecheck, 144 tests, lint (0 errors), `build` with the
  flag unset and `=false`.
- 2026-10-08 — Storefront `?tenant=` fallback mode (`apps/tenant_store`, uncommitted): new
  `NEXT_PUBLIC_ALLOW_SUBDOMAIN` (build-time; `allowSubdomain()` in `src/lib/tenant/host.ts`). A
  tenant subdomain host always wins; `?tenant=` is only read on the platform apex when the flag is
  off, only for a slug passing `isValidTenantSlug` (else platform), and a valid-but-unknown slug is
  a tenant 404. `src/proxy.ts` resolves via `resolveTenantSlug`, injects a trusted `x-tenant-slug`
  into the forwarded request headers (and strips client-sent values), and replaced `withAuth` with a
  bare `getToken` session check; tenant-context redirects re-append the param when the flag is off.
  `loadStoreInfo`/`apiClient` read the header first; `apiClient` browser refresh/verify/logout and
  the Stripe return URL carry the param, and the login form passes the tenant through NextAuth's
  `tenant` credential (because `/api/auth/*` bypasses the proxy) so `authorize` can set
  `x-tenant-slug`. New `src/lib/tenant/url.ts` (`withTenantParam`,
  `getBrowserTenantSlug`), `src/lib/tenant/nav.tsx` (`TenantSlugProvider`, `TenantLink`,
  `useTenantRouter`, `useTenantParam`) fed by the tenant layout; server components use
  `getTenantParam()` + `withTenantParam`. All tenant-side `Link`/`useRouter` converted; platform
  links untouched. Product-detail canonical includes the param (home/products canonicals do not; see
  AGENTS.md Pitfalls). Env plumbing: `.env.example`, `Dockerfile` build arg, app + root `AGENTS.md`.
  Verified: typecheck, lint, `next build` with the flag unset and `=false`, plus a live routing
  matrix in both modes (apex vs `demo.localhost`, param preservation, spoofed-header stripping).
- 2026-10-08 — Local tenant storefront exposed via Cloudflare **quick tunnel** (no domain; plan
  `.kilo/plans/1791478502086-tunnel-tenant-storefront-no-domain.md`). `apps/tenant_store/.env.local`
  now sets `NEXT_PUBLIC_APP_ROOT_DOMAIN=trycloudflare.com`, `NEXTAUTH_URL=https://<label>.trycloudflare.com`
  (API tunnel unchanged for `NEXT_PUBLIC_BACKEND_URL`); `apps/api/.env` `CORS_ORIGIN` gained the
  tunnel origin. Tenant slug must equal the tunnel's first DNS label (created tenant id 15, slug
  `night-casino-converter-filme`). **Ephemeral**: a new quick-tunnel label needs a new tenant. Both
  dev servers (tenant_store, saas_store_api) run as session background processes; the API tunnel and
  storefront tunnel are separate `cloudflared` quick tunnels.
- 2026-10-08 — Store-owner dashboard email verification + password reset (uncommitted,
  `apps/store_owner_dashboard`): new `src/api/otp.api.ts` (`requestOtp`, `verifyEmailOtp`,
  `confirmPasswordReset` over the tenant OTP routes) and public pages `/verify-email`,
  `/forgot-password`, `/reset-password` (forms in `src/components/refine-ui/form/`, OTP slots via a
  vendored `input-otp` component + new `input-otp` dependency). `authProvider.login` now treats an
  unverified email (successful `verified === false` **or** `401 EMAIL_NOT_VERIFIED`) as
  `{ success: true, redirectTo: '/verify-email?email=…' }` and stores **no** session.
  `ApiError` gained the optional `code`, and the OTP/reset routes were added to `AUTH_ENDPOINTS`.
  Sign-in form links to `/forgot-password`. Verified: `tenant_dash` typecheck, 127 tests, lint
  (0 errors), and `build` all pass.
- 2026-10-08 — Email OTP (all uncommitted):
  - **Config**: new `otp` and `email` groups in `IENV`/`buildEnv`/Joi (`env.interface.ts`,
    `env.mode.ts`, `env.schema.ts`) and `.env.example`. `OTP_HASH_SECRET` and `EMAIL_FROM_ADDRESS`
    are required; `EMAIL_PROVIDER` selects `smtp|log|memory` (dev: `log`); `OTP_REQUIRE_EMAIL_VERIFIED`
    defaults `false`. **An existing `apps/api/.env` must add these or the API will not boot.**
  - **Email seam** `src/modules/email/`: `EmailService` over an `EMAIL_TRANSPORT` factory
    (`SmtpEmailTransport` on the new `nodemailer` dep, `LogEmailTransport`, `MemoryEmailTransport`)
    plus an OTP template. The `log` transport never logs the code.
  - **OTP core** `src/modules/email-otp/`: `OtpChallenge` (tenant entity in `TENANT_ENTITIES`;
    partial unique active index; FK `userId` cascade), `OtpPurpose`, `otp-code.util`
    (HMAC-SHA256 + `timingSafeEqual`), `EmailOtpService.request/verify` (resend cooldown + per-window
    cap + `attempts`, pessimistic-lock consume), `EmailOtpController`.
  - **Flows**: `POST /auth/register` dispatches an `EMAIL_VERIFICATION` OTP; `POST
    /auth/email-otp/{request,verify}`; `EMAIL_VERIFICATION` sets `emailVerified`; `LOGIN_MFA`
    returns credentials; `PASSWORD_RESET` → `POST /auth/password-reset/confirm` rotates password +
    clears `jti`. Login can be gated by `OTP_REQUIRE_EMAIL_VERIFIED`. Anti-enumeration generic 200.
  - **DB**: `test/migrate-otp-challenges.ts` (idempotent production SQL);
    `test/verify-email-otp.ts` (manual integration). Unit specs added.
  - **Storefront** (`apps/tenant_store`): `src/api/otpApi.ts`; public `/verify-email`,
    `/forgot-password`, `/reset-password` pages (added to the proxy allowlist); register routes to
    `/verify-email?email=…`; login shows a verify link on `EMAIL_NOT_VERIFIED`; code entry uses the
    shadcn `input-otp` component (`input-otp` dependency added).
  - **Guard**: global `EmailVerifiedGuard` (`auth/guards/email-verified.guard.ts`) requires a
    verified email on **every** authenticated tenant route. Runs after `JwtGuard`; skips
    `@Public`/`@Platform`; rejects unverified users with `403 { code: 'EMAIL_NOT_VERIFIED' }`.
    `@AllowUnverifiedEmail()` is the opt-out (used on `POST /auth/logout`). `JwtGuard` now sets
    `request.user.emailVerified`. Store owners registered via `register-store` start unverified, so
    they are blocked from store routes until they verify (per user decision).
  - Verified: `pnpm --filter saas_store_api test -- --runInBand` (78 suites, 1028 tests), `typecheck`,
    and targeted `eslint --fix` (all 0).
- Earlier (uncommitted): storefront platform/tenant host routing; API subscriptions/guard/schema-size/
  seeding; storefront architecture-review remediation.

## Decisions taken

- Store-owner `?tenant=` mode mirrors the storefront (plan section "Decisions (locked)"): flag name
  `VITE_ALLOW_SUBDOMAIN` (only literal `false` off), root domain `VITE_APP_ROOT_DOMAIN` used only
  when off, precedence host > param > `sessionStorage` (`tenant-slug`), two entry points kept
  separate to preserve flag-ON behavior, no shared `packages/*` resolver (duplicated in-app), backend
  remains the security boundary. Known limitation: tokens stay in `localStorage`, so a shared apex
  origin collides across tabs with different `?tenant=` (guard clears on mismatch; keys not renamed).
- Earlier OTP plan section 19 defaults: D1 `synchronize` in dev/staging + idempotent SQL for prod;
  D2 `nodemailer` SMTP + log/memory; D3 tenant-scoped only; D4 register auto-sends + explicit request
  endpoint; D5 flag default false; D6 MFA dormant (no `User.mfaEnabled` yet); D7 HMAC-SHA256 +
  `timingSafeEqual`; D8 no `/resend`.

## Working tree state (check before relying on HEAD)

HEAD is `b565e5a`. Large uncommitted work spans the API (incl. the OTP feature), both dashboards
(incl. this `?tenant=` work), `project-description.md`, and the storefront. Verify with
`git status --short` before relying on HEAD.

## Known tooling issues

- Full-repo `pnpm --filter saas_store_api lint` can OOM (`Zone Allocation failed`); lint changed
  files with `npx eslint <files> --fix`.
- `pnpm --filter saas_store_api test` (parallel workers) can OOM; run with `-- --runInBand`.
- `pnpm --filter tenant_dash test` (parallel forks) can OOM at worker startup (exit 134) on this
  machine; run with `pnpm --filter tenant_dash exec vitest run --no-file-parallelism` (all 144 tests
  across 12 files then pass).
- `next build` for `tenant_store` can OOM; use `NODE_OPTIONS=--max-old-space-size=8192`.

## Next steps

- Add the new env vars to the local `apps/api/.env` (`OTP_HASH_SECRET`, `EMAIL_FROM_ADDRESS`,
  `EMAIL_PROVIDER=log`) before running the API.
- Run the optional live checks once Postgres is up: `test/verify-email-otp.ts` and
  `test/migrate-otp-challenges.ts`.
- Manual `?tenant=` matrix for `tenant_dash` (flag `false`): `http://localhost:5174/?tenant=my-store`
  logs in and keeps the param across navigation/refresh; `?tenant=BAD_SLUG` → API 400;
  `my-store.localhost:5174` still resolves without a param; logout/re-login stays in-tenant.
- Phase 2 (not started): login MFA needs a `User.mfaEnabled` column; platform OTP needs a public
  `PlatformOtpChallenge` entity + `@Platform` controller.
