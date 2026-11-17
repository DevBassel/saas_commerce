# Active Context — saas_commerce

Current focus and recent changes. Rewritten on each update.

## Current focus

**Email verification context and resend timer (2026-11-11).** The API now returns the configured
`resendCooldownSeconds` for every generic OTP request outcome and customer registration. The
storefront and store-owner dashboard keep pending verification email, tenant slug, and an absolute
resend deadline in tenant-bound per-tab `sessionStorage`. `/verify-email` URLs no longer carry an
email address; apex routing may still retain `?tenant=<slug>`. Password-reset URLs are unchanged.

## Verification

- Focused API Jest: 2 suites, 44 tests pass; API typecheck passes.
- Store-owner dashboard: 15 Vitest files, 174 tests pass with the canonical localhost API URL;
  lint passes with five pre-existing warnings, typecheck passes, and the production build passes
  with the existing large-chunk warning.
- Storefront lint, typecheck, and the 17-route production build pass.
- Manual browser acceptance checks were not run.

## Previous payment work

Payment reliability and security hardening with ownership-aligned tests remains in the worktree.
Existing routes, DTOs, response shapes, Stripe metadata, and frontend contracts are preserved.

- **Cross-Tenant Stripe Idempotency Isolation:** order keys include tenant ID
  (`tenant:${tenant.id}:order:${order.id}:payment:v1`). Subscription keys also include tenant,
  subscription, plan, and billing interval. Creation locks the subscription row inside a transaction,
  reuses active intents (including `processing`), and preserves conflicts for succeeded/canceled intents.
- **Order Ownership (BOLA / IDOR) Validation:** `OrderPaymentService.createOrderPaymentIntent`
  requires the authenticated user, hides foreign orders with `NotFoundException`, and permits users
  with order management permission or store/platform owner roles. The controller request is required
  at the type level, matching actual authenticated Nest request handling.
- **Payment Unit-Test Refactor:** `stripe.payment.service.spec.ts` now verifies only facade
  delegation. Order creation/refunds/reconciliation live in `order-payment.service.spec.ts`; webhook
  routing lives in the new `stripe-webhook.service.spec.ts`; account/onboarding/payout behavior lives
  in the new `stripe-connect.service.spec.ts`; subscription locking, intent reuse, idempotency,
  reconciliation, and cancellation live in `subscription-payment.service.spec.ts`.
- `workflow.md` documents tenant-scoped idempotency and ownership checks.

## Previous payment verification (not rerun)

- Payment tests: 9 suites, 144 tests pass.
- Full API unit tests: 108 suites, 1,404 tests pass.
- Payment-module ESLint: pass.
- API typecheck (`tsc --noEmit`): pass.
- `git diff --check`: pass (line-ending conversion warnings only).

## Preserved reliability behavior and remaining debt

- A canceled order PaymentIntent still triggers 409 Conflict without auto-rotating to `:v2`.
- Webhook updates to Payment and Order rows are executed outside one database transaction.
- Webhook event IDs are not deduplicated in a dedicated processed-events table.
- Order reconciliation writes `canceledAt`/`failedAt` properties that are not declared on TypeORM
  entities.

## Working tree state

Existing uncommitted payment, super-admin dashboard, and storefront dev-origin changes were left
untouched. This task changes only the planned API, storefront, store-owner dashboard, tests, and
documentation. No commits were created.
