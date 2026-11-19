# Active Context

## Snapshot

Date: 2026-11-19.

Git command evidence (`git status --short --branch`, `git log --oneline -10`, and `git diff --stat`) shows `main` is one commit ahead of `origin/main`, with application changes and deletions still in the working tree. Git state has no path:line location; implementation claims below are separately tied to current source.

## Current focus

The uncommitted API work is hardening Stripe webhook delivery and payment-state concurrency:

- A public `stripe_webhook_events` inbox records unique event ids, resource ordering, payload, claim state, attempts, failure, and retry timing (`apps/api/src/modules/payments/entities/stripe-webhook-event.entity.ts:13-77`; `apps/api/src/core.module.ts:25-42`).
- Signature-verified events are persisted before processing; reconciliation includes pending, due-failed, and stale-processing rows (`apps/api/src/modules/payments/webhooks/stripe-webhook.service.ts:64-124`; `apps/api/src/modules/payments/webhooks/stripe-webhook.service.ts:197-219`).
- Processing uses transactional claims, per-resource PostgreSQL advisory locks, row locks, terminal success, and exponential retry scheduling (`apps/api/src/modules/payments/webhooks/stripe-webhook.service.ts:221-283`; `apps/api/src/modules/payments/webhooks/stripe-webhook.service.ts:306-385`).
- API scripts expose an idempotent schema update and a reconciliation entry point (`apps/api/package.json:24-30`; `apps/api/test/migrate-stripe-webhook-events.ts:5-12`; `apps/api/test/reconcile-stripe-webhooks.ts:5-20`).
- Subscription payment handling now uses row locks and state guards around plan application/refund transitions (`apps/api/src/modules/payments/services/subscription-payment.service.ts:351-448`; `apps/api/src/modules/payments/services/subscription-payment.service.ts:451-557`; `apps/api/src/modules/subscriptions/services/subscription.service.ts:164-241`).

Do not describe this work as committed until Git status changes.

## Recent committed change

`HEAD` is `6e960bf` (`fix order cancelation`) according to `git log`. The resulting current source centralizes locked order reads for mutations (`apps/api/src/modules/orders/orders.helpers.ts:113-119`) and locks products during checkout stock evaluation (`apps/api/src/modules/orders/orders.service.ts:138-146`).

## Unrelated working-tree state

Git status also reports deletions under `load-tests/k6/**`. They were not modified during this Memory Bank refresh and whether they are intentional is **unknown**. The prior six Memory Bank files were also deleted in the working tree; this task recreates only those six files.

## Next steps

1. Validate the current API work with the manifest-provided typecheck, unit-test, and build commands before committing (`apps/api/package.json:8-23`). Current pass/fail status from this refresh is **unknown** because application checks were not run.
2. For an environment with public-schema synchronization disabled, apply the idempotent webhook schema script before accepting these events (`apps/api/test/migrate-stripe-webhook-events.ts:5-12`; `apps/api/test/migrate-stripe-webhook-events.ts:80-89`).
3. Decide whether the `load-tests/k6/**` deletions are intentional; disposition is **unknown**.
4. Restore or replace the missing root cross-app contract document and clarify the root Compose entry point; both remain **unknown** (`apps/api/AGENTS.md:6-7`; `apps/docker-compose.yml:1-48`).

## Rule pointers

Follow [API Payments](../apps/api/AGENTS.md#payments), [API Tests](../apps/api/AGENTS.md#tests), and each app's own `AGENTS.md`. The absent root `AGENTS.md` cannot currently supply the cross-app rules referenced by those files.
