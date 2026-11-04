# Active Context — saas_commerce

Current focus and recent changes. Rewritten on each update.

## Current focus

**Payments module architecture refactor completed and verified.** The exported
`StripePaymentService` remains a compatibility facade, so controllers and existing consumers keep
the same dependency and method surface. Four focused providers now own order payments, subscription
payments, webhook dispatch, and Stripe Connect operations. `StripeClientService` owns one shared
Stripe SDK instance.

The refactor preserves all existing routes, DTOs, response shapes, HTTP status behavior, exceptions,
tenant resolution, Stripe metadata, entities, and frontend integration. No frontend or schema file
was changed.

## Recent changes

- Added `services/order-payment.service.ts` for order PaymentIntent creation, refunds, and order
  payment reconciliation.
- Added `services/subscription-payment.service.ts` for plan purchase intents, subscription refunds,
  cancellation, and subscription payment reconciliation.
- Added `webhooks/stripe-webhook.service.ts` for signature verification, event classification, and
  dispatch to domain services.
- Added `services/stripe-connect.service.ts` for Connect accounts, onboarding, balances, payouts,
  and account status.
- Added `stripe/stripe-client.service.ts` as the sole Stripe SDK constructor.
- Reduced `stripe.payment.service.ts` from 931 lines to a thin compatibility facade.
- Removed obsolete `payments.service.ts`; its order and subscription methods moved to the matching
  domain services.
- `PaymentsModule` now imports `TenantModule` and reuses its `TenantManagerService` instead of
  creating a second DataSource cache.
- Updated payment workflow documentation and API architecture guidance.
- Added subscription service coverage, module dependency-injection coverage, and characterization
  tests for current order locking, active-intent reuse, fixed Stripe idempotency key, and conflicts.

## Verification

- Payment-focused lint: pass.
- Full API lint: 11 pre-existing errors remain in unrelated reorganized test files.
- Payment tests: 7 suites, 120 tests pass.
- Full API unit tests: 106 suites, 1,380 tests pass.
- API integration tests: 4 suites, 65 tests pass; 1 suite / 4 tests skipped.
- API typecheck: pass.
- API build: pass.

## Preserved reliability behavior and debt

- Current uncommitted order-intent reliability behavior remains unchanged: pessimistic order lock,
  active PaymentIntent reuse, paid/canceled conflicts, atomic tenant DB writes, and fixed
  `order:{orderId}:payment:v1` Stripe idempotency key.
- Stripe retrieve/create calls remain inside the pessimistic order transaction. Changing that needs
  a separate reliability design because moving Stripe outside the lock changes concurrency behavior.
- A canceled order PaymentIntent has no new-attempt path while the fixed idempotency key remains at
  version `v1`.
- Subscription intent creation still has no explicit idempotency key or pending-intent reuse.
- Webhook event IDs are not persisted for deduplication; state updates remain idempotent only where
  existing logic provides it.
- Order reconciliation still writes `canceledAt`/`failedAt` properties absent from entity columns.
- Order mirror writes and subscription plan/ledger writes are not single database transactions.

## Working tree state

Payment refactor is uncommitted. Root `AGENTS.md` also contains pre-existing unrelated changes and
must not be reverted. Recheck Git state before any commit.
