# Progress

## Implemented capabilities evidenced in current source

- **Four application surfaces:** one API, two Refine administration SPAs, and one Next.js storefront/platform app are present as workspace packages (`apps/api/package.json:1-8`; `apps/store_owner_dashboard/package.json:1-5`; `apps/super_admin_dashboard/package.json:1-5`; `apps/tenant_store/package.json:1-10`).
- **Schema-per-tenant isolation:** tenant repositories come from schema-bound, cached TypeORM data sources with a dedicated tenant entity list (`apps/api/src/modules/tenants/services/tenant-manager.service.ts:19-53`; `apps/api/src/modules/tenants/services/tenant-manager.service.ts:71-81`; `apps/api/src/modules/tenants/utils/tenant-entities.ts:18-34`).
- **Authentication/authorization pipeline:** tenant, JWT, email-verification, permission, subscription, and throttle guards are globally registered (`apps/api/src/app.module.ts:75-100`).
- **Commerce modules:** catalog, cart, orders, coupons, payments, addresses, storefront, and subscriptions are composed in the API (`apps/api/src/app.module.ts:56-74`).
- **Platform operations:** the Super Admin app implements tenant, payment, currency-request, and subscription-plan routes (`apps/super_admin_dashboard/src/App.tsx:134-155`).
- **Tenant operations:** the Store Owner app implements catalog, coupon, order, user, payment, store, and subscription routes (`apps/store_owner_dashboard/src/App.tsx:111-158`).
- **Storefront context split:** the Next.js proxy routes apex/platform and tenant traffic separately and protects non-public tenant routes (`apps/tenant_store/src/proxy.ts:132-250`).
- **Embedded platform delivery:** the Super Admin production build targets API static output and the API serves `/platform` root/deep links (`apps/super_admin_dashboard/vite.config.ts:58-80`; `apps/api/src/app.module.ts:31-55`).

## Recent progress

- The latest commit (`6e960bf`, from `git log --oneline`) leaves current order mutation code using pessimistic locks (`apps/api/src/modules/orders/orders.helpers.ts:113-119`).
- Working-tree API changes add durable Stripe event storage, serialized processing, retries, and reconciliation (`apps/api/src/modules/payments/entities/stripe-webhook-event.entity.ts:13-77`; `apps/api/src/modules/payments/webhooks/stripe-webhook.service.ts:197-385`; `apps/api/test/reconcile-stripe-webhooks.ts:5-20`). This work is **not committed** at the snapshot.
- The six Memory Bank core files have been recreated by the current documentation-only task; no application file was edited.

## Verification coverage available

- API exposes Jest unit, integration, and e2e commands (`apps/api/package.json:17-23`; `apps/api/package.json:90-123`).
- Store Owner exposes Vitest in addition to build/typecheck/lint (`apps/store_owner_dashboard/package.json:66-73`).
- Super Admin and Tenant Store expose build/typecheck/lint but no test script in their current manifests (`apps/super_admin_dashboard/package.json:89-94`; `apps/tenant_store/package.json:5-10`).
- Current application validation result is **unknown**; this refresh validates documentation scope/citations only.

## Open debt and gaps

- **Cross-app instructions:** root `AGENTS.md` is absent although all app instruction files depend on it; cross-app contract ownership is **unknown** (`apps/api/AGENTS.md:6-7`; `apps/store_owner_dashboard/AGENTS.md:6-6`; `apps/super_admin_dashboard/AGENTS.md:7-7`; `apps/tenant_store/AGENTS.md:6-6`).
- **Compose entry point:** root `compose.yaml` is absent. The intended root workflow is **unknown**; an app-level Compose file exists (`apps/docker-compose.yml:1-48`).
- **Schema evolution:** a general TypeORM migration track is **unknown**. The current API exposes a feature-specific idempotent webhook schema script (`apps/api/package.json:29-30`; `apps/api/test/migrate-stripe-webhook-events.ts:5-12`).
- **Load tests:** Git status reports `load-tests/k6/**` deleted in the working tree; whether removal is intended is **unknown**.
- **Production status:** deployment environment, CI status, SLOs, and release readiness are **unknown**.

## Present but not wired or incomplete

- Tenant Store contains cart update/clear operations that are not wired to its UI (`apps/tenant_store/AGENTS.md:187-191`).
- Super Admin contains unused REST/form/view boilerplate that is not wired, and its identity shape does not satisfy the mounted avatar/info components (`apps/super_admin_dashboard/AGENTS.md:139-149`).
- Tenant Store image hosts are hard-coded; its documented `R2_PUBLIC_URL` is not wired into Next image configuration (`apps/tenant_store/AGENTS.md:212-222`).
- Subscription resume/re-subscribe and recurring Stripe Billing are not implemented (`apps/api/AGENTS.md:359-368`; `apps/api/AGENTS.md:400-412`).
- Database entitlement enforcement runs at checkout rather than across every tenant write (`apps/api/AGENTS.md:423-444`).

## Reference links

Use [API conventions](../apps/api/AGENTS.md#conventions-and-quirks), [Store Owner pitfalls](../apps/store_owner_dashboard/AGENTS.md#pitfalls), [Super Admin pitfalls](../apps/super_admin_dashboard/AGENTS.md#pitfalls), and [Tenant Store pitfalls](../apps/tenant_store/AGENTS.md#pitfalls) instead of duplicating durable rules in this bank.
