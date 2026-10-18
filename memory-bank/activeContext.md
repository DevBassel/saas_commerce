# Active Context — saas_commerce

Current focus and recent changes. This file is **rewritten**, not appended, on every update.
Most dynamic file in the bank — keep it short and current.

## Current focus

**Store-owner self-serve subscription cancel + refund** (`apps/api` + `apps/store_owner_dashboard`,
uncommitted). Implemented per `.kilo/plans/1791582083889-tenant-cancel-refund-7-days.md`: a new
tenant-scoped `POST /payments/stripe/subscription/cancel` (`subscriptions:manage`) refunds the
tenant's latest **PAID** `SubscriptionPayment` on the platform account and downgrades to free, but
only within a **7-day** window (`SUBSCRIPTION_REFUND_WINDOW_DAYS`) from that payment's `paidAt`
(fallback `createdAt`). `GET /subscription` gains additive `refundEligible`/`refundDeadline`, and
`tenant_dash` `/settings/subscription` shows a destructive Cancel/Refund button + confirm dialog when
eligible. The platform (Super Admin) cancel route is unchanged (no window).

## Recent changes

- 2026-10-09 — Tenant self-serve subscription cancel + refund (uncommitted):
  - `subscriptions/constants/subscription.constants.ts` — added `SUBSCRIPTION_REFUND_WINDOW_DAYS = 7`.
  - `stripe.payment.service.ts` — extracted the platform refund block into a private
    `refundSubscriptionPayment(payment)` (idempotency key `refund-subscription-{paymentId}`); added
    `cancelOwnSubscription(tenantId)` (PAID-only, 7-day guard, `409 SUBSCRIPTION_NOT_REFUNDABLE` /
    `409 REFUND_WINDOW_EXPIRED`, idempotent when a REFUNDED row exists). `cancelSubscriptionWithRefund`
    (platform) keeps its no-window behavior via the helper.
  - `payments.controller.ts` — added `POST /payments/stripe/subscription/cancel`
    (`@Permissions([subscriptions:manage])`, `403` when no tenant).
  - `subscriptions.module.ts` — added the public `SubscriptionPayment` entity to `forFeature`
    (entity import, not a module cycle) so `SubscriptionService` can read the ledger.
  - `subscription.service.ts` — added `getRefundInfo(subscription)` (latest PAID → eligible + ISO
    deadline); `subscription.controller.ts` `get()` is now async and merges the two fields.
  - `tenant_dash` — `types/subscription.ts` (`refundEligible`/`refundDeadline`);
    `subscriptions.api.ts` `cancelSubscription()`; new `CancelSubscriptionDialog.tsx`; the
    current-plan card renders the destructive button + deadline line when `refundEligible`.
  - Tests: reconciled the two stale payments specs (`createPayment`→`createOrderPaymentIntent`,
    renamed webhook handlers, 6-arg `StripePaymentService` / 5-arg `SubscriptionService` /
    3-arg `PaymentService` mocks) and added `cancelOwnSubscription` + `getRefundInfo` specs.
  - Docs: `apps/api/AGENTS.md` (`## Payments`, `## Subscriptions`), `payments/workflow.md`,
    `apps/store_owner_dashboard/AGENTS.md` (`## Subscription`).
  - **Verified:** `pnpm --filter saas_store_api typecheck` clean (the prior stale-spec errors are
    gone); `pnpm --filter saas_store_api exec jest --runInBand` = **79 suites / 1047 tests green**;
    eslint on changed files clean; `pnpm --filter tenant_dash typecheck`/`build` pass, `lint` 0 errors,
    `vitest run` 14 files / 169 tests green.

- 2026-10-09 — Store-owner self-serve subscription checkout (uncommitted): the subscription page
  re-adds an **Upgrade** button per non-current billable plan, opening a Stripe Elements
  `PlanCheckoutDialog` that calls `POST payments/stripe/subscription` for a `clientSecret`, confirms
  with `stripe.confirmPayment({ redirect: "if_required" })`, and polls `GET subscription` until the
  `payment_intent.succeeded` webhook assigns the plan. See the 2026-10-09 entries below for detail.

  - `package.json` — added `@stripe/stripe-js@^9.8.0` + `@stripe/react-stripe-js@^6.6.0`
    (lockfile updated); `src/lib/stripe.ts` (new) exports `stripePromise` from the build-time
    `VITE_STRIPE_PUBLISHABLE_KEY` (null when unset).
  - `types/subscription.ts` — added `CreateSubscriptionPaymentResponse`; `subscriptions.api.ts` —
    added `createPaymentIntent(planId, billingInterval)` with an in-flight `Map` dedupe per
    `(planId, interval)` (mirrors the storefront `CreateStripePayment`, so StrictMode's double mount
    creates one `PENDING` row).
  - `pages/settings/subscription/PlanCheckoutDialog.tsx` (new) — mirrors the storefront
    `StripePaymentStep` state machine (`creating`/`error`/`attempt`, "Preparing payment…", Retry,
    `appearance: { theme: "night" }`), wrapped in a shadcn `Dialog`; creates the intent on open,
    renders `Elements` + `PaymentElement`, `confirmPayment({ redirect: "if_required" })`, `return_url`
    built with `withTenantParam`; surfaces API errors (`SUBSCRIPTION_NOT_FOUND`, `PLAN_*`, 403) with
    Retry, and the `stripePromise === null` "not configured" path. `onPaid` closes the dialog.
  - `pages/settings/subscription/index.tsx` — Upgrade button on non-current billable tabs, dialog
    state, a poll effect (`GET subscription` every ~2s, 30s cap → toast + banner), and 3DS return
    handling (`?stripe=return&plan=<id>`, `redirect_status`, params stripped via `replaceState`).
  - `Dockerfile` — added the `VITE_STRIPE_PUBLISHABLE_KEY` build arg; `.env.example` documents it.
  - Docs: `apps/store_owner_dashboard/AGENTS.md` (`## Subscription` rewritten).
  - **Verified:** `pnpm --filter tenant_dash typecheck` / `lint` / `build` pass; `test` green
    (14 files, 169 tests).
- 2026-10-09 — Webhook split: order vs subscription handlers (uncommitted, `apps/api`). Implemented
  per `.kilo/plans/1791574388584-webhook-order-subscription-handlers.md`: `StripePaymentService.webHook`
  now classifies each event on `metadata.data.kind` and dispatches to `handleOrderPaymentEvents` or
  `handleSubscriptionEvents`. Subscription `payment_intent.succeeded` completes the purchase — ledger
  `PAID` + `SubscriptionService.assignPlan` (`ACTIVE`/`TRIALING`, period, storage sync); canceled/failed
  update the ledger, and a **fully refunded** purchase falls back to the free plan
  (`SubscriptionService.downgradeToFree`; partial refunds keep the plan). A Super Admin
  `POST /platform/tenants/:id/subscription/cancel` now cancels + refunds a purchase synchronously. This
  closes the prior "`PENDING` forever / no webhook reconciliation" limitation.
- 2026-10-09 — Cancel + refund subscription (uncommitted):
  - `stripe.payment.service.ts` — added `cancelSubscriptionWithRefund(tenantId)`: refunds the latest
    `PAID` `SubscriptionPayment` on the **platform** account (no `reverse_transfer`/
    `refund_application_fee`; idempotency key `refund-subscription-{paymentId}`), marks the ledger
    `REFUNDED`, then calls the free fallback. No `PAID` row / missing `paymentRef` → cancel only.
  - `payments.service.ts` — added `downgradeSubscriptionToFree(subscriptionId)` delegator (reuses
    the injected `SubscriptionService`).
  - `platform-subscription-payment.controller.ts` (new, PaymentsModule) —
    `POST /platform/tenants/:id/subscription/cancel`, `@Platform @Roles([SUPER_ADMIN])`. It lives in
    `PaymentsModule` because the refund needs `StripePaymentService` and the fallback needs
    `SubscriptionService`, while `SubscriptionsModule` → `PaymentsModule` would be a cycle.
  - Docs: `apps/api/AGENTS.md`, `payments/workflow.md`.
  - **Verified:** typecheck clean of non-spec errors; eslint clean on changed files.
- 2026-10-09 — Webhook order/subscription split (uncommitted):
  - `constants/payment-metadata.ts` — added `isSubscriptionPaymentMetaData` type guard.
  - `payments.service.ts` — constructor grew to 3 args (`TenantManagerService`,
    `@InjectRepository(SubscriptionPayment)`, `SubscriptionService`); added
    `successSubscriptionPayment` (idempotent when already `PAID`; calls `assignPlan` then marks
    `PAID` + `paidAt`), `cancelSubscriptionPayment`, `failedSubscriptionPayment`,
    `refundedSubscriptionPayment` (cumulative-amount → `PAID`/`REFUNDED`/`PARTIALLY_REFUNDED`; on a
    full `REFUNDED` it calls `SubscriptionService.downgradeToFree`).
  - `subscription.service.ts` — added idempotent `downgradeToFree(subscriptionId)`: assigns the free
    plan (`FREE_PLAN_SLUG`) unless the subscription is already on it, so repeated refund events do
    not reset the period.
  - `payments.module.ts` — imports `SubscriptionsModule` (reverses the 2026-10-09 removal; no DI
    cycle: `SubscriptionsModule` imports only `TenantModule`).
  - `stripe.payment.service.ts` — `webHook` replaced by classify-and-delegate; deleted
    `syncRefundState`; added `handleOrderPaymentEvents`, `handleSubscriptionEvents`,
    `resolveRefundContext`, kept `latestCharge`. Order path unchanged (order metadata has no `kind`).
  - Docs: `apps/api/AGENTS.md` (`## Payments`, `## Subscriptions`), `payments/workflow.md`.
  - **Verified:** `pnpm --filter saas_store_api typecheck` shows only the two pre-existing stale-spec
    files (`payments.service.spec.ts`, `stripe.payment.service.spec.ts`); eslint clean on the four
    changed files (`NODE_OPTIONS=--max-old-space-size=4096`).
  - **Accepted limitation:** a `PLAN_INACTIVE` (or missing ledger row) on `succeeded` throws a
    non-2xx, so Stripe keeps retrying until resolved.
- 2026-10-09 — Subscription PaymentIntent endpoint (uncommitted):
  - `stripe.payment.service.ts` — replaced the plan-lookup-only stub of
    `createSubscriptionPaymentIntent` with: tenant-context check (403) → plan 404 → `PLAN_INACTIVE` /
    `PLAN_NOT_PUBLIC` (400) → interval price ≤ 0 → `PLAN_NOT_PURCHASABLE` (400) → tenant
    `Subscription` lookup (404 `SUBSCRIPTION_NOT_FOUND`) → Stripe `paymentIntents.create` on the
    **platform** account (no `transfer_data`/`application_fee_amount`, no `paymentsPaused` gate) →
    save `SubscriptionPayment` (`status = PENDING`, `paymentRef = intent.id`, `amount` in major
    units) → `{ clientSecret }`. Constructor grew to 6 args (added
    `@InjectRepository(SubscriptionPayment)`).
  - `payments.controller.ts` — `POST /payments/stripe/subscription`, gated by
    `subscriptions:manage` (STORE_OWNER only; ADMIN has `subscriptions:read` only; SUPER_ADMIN
    bypasses).
  - `dto/create-sub.dto.ts` — added optional `billingInterval` (`BillingInterval`, default MONTHLY).
  - `constants/payment-metadata.ts` — added `subscriptionPaymentMetaData` (`kind: 'subscription'`),
    separate from `paymentMetaData`; not consumed by the webhook.
  - Docs: `apps/api/AGENTS.md` (`## Payments`, `## Subscriptions`), `payments/workflow.md`.
  - **Verified:** typecheck shows only the pre-existing stale-spec errors (`payments.service.spec.ts`,
    `stripe.payment.service.spec.ts`); eslint clean on changed files (needs
    `NODE_OPTIONS=--max-old-space-size=4096`).
  - **Superseded:** the initially-shipped "no webhook path, rows stay `PENDING` forever" limitation
    was closed the same day by the webhook order/subscription split above.
- 2026-10-09 — New public `SubscriptionPayment` entity (`payments/entities/subscription-payment.entity.ts`):
  `id`, `subscriptionId` FK → `Subscription` (`ON DELETE CASCADE`)+`@Index`, non-FK `planId`
  snapshot (`@Index`), `billingInterval` (`BillingInterval`, default `MONTHLY`), `provider`
  (`PaymentsProviders`), `status` (`PaymentStatus`, default `UNPAID`), `amount` (`moneyColumn`),
  `currency`, `paymentRef`, `providerReference`, `refundReference`, `refundedAmount`
  (`moneyColumnWithDefault(0)`), `failureReason`, `paidAt`, `refundedAt`, timestamps. Registered in
  `core.module.ts` `PUBLIC_ENTITIES` (synchronize creates the table) and `payments.module.ts`
  `forFeature`. `planId` is deliberately non-FK so history survives plan deletion.
- 2026-10-09 — Removed self-serve subscription payment (uncommitted):
  - **API.** Deleted `StripeBillingService` (+ spec) and the checkout DTOs; removed the tenant
    `POST /subscription/checkout/{intent,complete}`, `/cancel`, `/resume` routes and their `billing`
    injection; dropped `StripeBillingService` from `SubscriptionsModule`; `PaymentsModule` no longer
    imports `SubscriptionsModule`. Removed the five `customer.subscription.*` / `invoice.*` cases
    from the payments webhook (they now fall through to the default "unhandled" branch). Removed the
    `Subscription` Stripe columns (`stripeCustomerId`, `stripeSubscriptionId`, `stripePriceId`,
    `cancelAtPeriodEnd`, `canceledAt`) and the billing-only service methods (`applyStripePlan`,
    `setStripeCustomerId`, `StripePlanPatch`); `assignPlan`/`updateStatus` no longer write those
    fields. Removing the columns changes the DB schema under `synchronize`.
  - **Dashboard.** Deleted `components/subscription/**` and `lib/stripe.ts`; `subscriptions.api.ts`
    is reads-only; `/settings/subscription` is read-only (no upgrade CTA / cancel / resume /
    auto-renewal card); removed the `stripe*` fields from `types/subscription.ts`,
    `VITE_STRIPE_PUBLISHABLE_KEY` from `vite-env.d.ts`/`.env.example`/`Dockerfile`, and the
    `@stripe/*` deps from `package.json` (lockfile refreshed).
- 2026-10-09 — `tenant_dash` review-fix pass (uncommitted, dashboard only): session/tenant cache
  reset, `canManageCatalog` gates, explicit-`null` clearing, error+retry states, `RouteErrorBoundary`,
  `nextStatuses`-gated order status, confirmation dialogs, a11y labels, and devtools DEV-gating.

## Decisions taken

- The 2026-10-09 "remove anything about subscription payment" applied to the **Stripe Billing**
  flow (recurring checkout + billing webhook + `Subscription` Stripe columns). The later
  `POST /payments/stripe/subscription` **re-adds a one-off platform-account PaymentIntent purchase**
  (plan → `clientSecret`), and the same day the webhook split added **self-serve completion**:
  `handleSubscriptionEvents` assigns the plan on `payment_intent.succeeded`, and a **full** refund of
  that purchase downgrades the tenant back to the free plan (partial refunds keep the paid plan).
  Still out of scope: Stripe recurring Billing (BillingPortal/proration) and webhook event
  dedupe. `subscriptions:manage` gates the purchase route (it had gated no route after the removal).
- Subscription **plan/entitlement management** (Super Admin assignment, `SubscriptionGuard`,
  `SubscriptionEntitlementsService`) remains unchanged and is not payment.

## Working tree state (check before relying on HEAD)

HEAD is `7a1f055`. Large uncommitted work spans `apps/api`, `apps/store_owner_dashboard`, the memory
bank, and the subscription feature. Verify with `git status --short` before relying on HEAD.

## Known tooling issues

- `pnpm install` can crash with a pnpm (Rust) allocator failure; retry with `pnpm install
  --prefer-offline` completes the link + lockfile update.
- Full-repo `pnpm --filter saas_store_api lint` can OOM; lint changed files with
  `NODE_OPTIONS=--max-old-space-size=4096 npx eslint <files> --fix`. `pnpm --filter saas_store_api
  test` may OOM; use `-- --runInBand`.
- `pnpm --filter tenant_dash test` can OOM (exit 134); use
  `pnpm --filter tenant_dash exec vitest run --no-file-parallelism`.
- `next build` for `tenant_store` can OOM; use `NODE_OPTIONS=--max-old-space-size=8192`.

## Next steps

- Manual dashboard checkout check: with `apps/api/.env` Stripe test keys + `VITE_STRIPE_PUBLISHABLE_KEY`
  set and `stripe listen --forward-to localhost:4000/api/v1/payments/stripe/webhook`, buy a billable
  plan from `/settings/subscription` with test card `4242…`; confirm the poll flips the plan and an
  ADMIN gets a surfaced 403. 3DS card `4000 0025 0000 3155` exercises the redirect-return poll.
- Boot-check the API against a dev DB: confirm no DI cycle from `PaymentsModule → SubscriptionsModule`,
  that `subscription_payments` is created, and that the endpoint returns a `clientSecret` for a paid
  public plan as a STORE_OWNER (needs a live Stripe test key).
- End-to-end check with `stripe listen --forward-to`: confirming a subscription intent flips the
  ledger to `PAID`, the tenant `Subscription` becomes `ACTIVE`/`TRIALING` with a period, and an order
  intent still completes through `handleOrderPaymentEvents` unchanged.
- Consider catching-and-acking `assignPlan` failures (e.g. `PLAN_INACTIVE` between intent creation
  and `succeeded`) so Stripe stops retrying indefinitely.
- Triage the deferred Low backlog in Section 3 of the tenant-dashboard review-fix plan
  (`.kilo/plans/1791552085658-tenant-dashboard-review-fix-plan.md`).
