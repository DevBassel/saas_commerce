# Product Context

## Problem and value

The product aims to let one platform operate many isolated online stores while giving each audience a purpose-built surface. The vision explicitly calls out tenant isolation, RBAC, Stripe payments/refunds, object storage, subscription entitlements, two administration consoles, and a customer storefront (`project-description.md:3-11`). Source confirms those surfaces exist; the vision document alone is not proof of production readiness.

## Domain mental model

- The **platform plane** owns the tenant registry, platform identities/RBAC, subscription plans and assignments, currency requests, and the durable Stripe event inbox (`apps/api/src/core.module.ts:27-42`).
- Each **tenant plane** owns store identities/RBAC and its catalog, cart, orders, payments, addresses, coupons, and OTP challenges in a dedicated PostgreSQL schema (`apps/api/src/modules/tenants/utils/tenant-entities.ts:18-34`).
- A tenant is selected before tenant data is accessed: the API resolves headers or the configured-root subdomain, while the storefront proxy replaces untrusted tenant headers with its own resolved value (`apps/api/src/modules/tenants/services/tenant-resolution.service.ts:30-58`; `apps/tenant_store/src/proxy.ts:33-55`).
- Platform operators govern tenants and plans; store operators configure one tenant; shoppers browse and transact inside that tenant. Subscription entitlements constrain tenant capabilities at the API boundary (`apps/api/src/app.module.ts:75-100`; `apps/api/AGENTS.md:359-444`).

## Primary actors and implemented journeys

### Platform operator

- Uses the Super Admin SPA to manage tenants, platform payments, currency requests, and subscription plans (`apps/super_admin_dashboard/src/App.tsx:134-155`).
- Uses a platform-scoped API client that adds authorization but no tenant header (`apps/super_admin_dashboard/src/api/client.ts:51-62`).
- Receives the production SPA from the API under `/platform`; the dashboard build writes into the API static directory (`apps/api/src/app.module.ts:31-55`; `apps/super_admin_dashboard/vite.config.ts:58-80`).

### Store owner or tenant administrator

- Uses the tenant dashboard for products, categories, coupons, orders, users, payment connection, store settings, and subscriptions (`apps/store_owner_dashboard/src/App.tsx:111-158`).
- The client attaches resolved tenant context and performs a single-flight session refresh on unauthorized responses (`apps/store_owner_dashboard/src/api/client.ts:61-75`; `apps/store_owner_dashboard/src/api/client.ts:86-120`; `apps/store_owner_dashboard/src/api/client.ts:127-157`).

### Shopper

- Reaches tenant storefront routes only in a resolved tenant context; platform-only paths are redirected away from tenant hosts (`apps/tenant_store/src/proxy.ts:154-186`).
- Public catalog/auth routes pass through, while protected tenant routes require or refresh a session (`apps/tenant_store/src/proxy.ts:174-229`).
- Unknown tenant storefronts produce a hard 404 rather than a generic or mis-branded store (`apps/tenant_store/src/app/(tenant)/layout.tsx:52-59`).

### Prospective tenant

- Uses the apex platform shell to navigate Home, Plans, and Start a store (`apps/tenant_store/src/app/(platform)/layout.tsx:15-29`; `apps/tenant_store/src/proxy.ts:132-151`).

## Product behavior that shapes UX

- Tenant identity comes from host/header context rather than from arbitrary page state (`apps/api/src/modules/tenants/services/tenant-resolution.service.ts:30-58`).
- Store branding and currency are loaded into the tenant root layout, with a safe default on transient store-info failure (`apps/tenant_store/src/app/(tenant)/layout.tsx:52-90`).
- Session rotation is deduplicated in browser clients to avoid concurrent refresh races (`apps/store_owner_dashboard/src/api/client.ts:86-120`; `apps/tenant_store/src/api/apiClient.ts:29-55`).

## UX goals evidenced by implementation

- Preserve tenant identity across navigation and authentication without trusting arbitrary browser-supplied tenant headers (`apps/tenant_store/src/proxy.ts:33-55`; `apps/store_owner_dashboard/src/App.tsx:76-109`).
- Fail clearly rather than display the wrong store: invalid hosts rewrite to 404, unknown tenants call `notFound()`, and unresolved dashboard tenants surface an API error (`apps/tenant_store/src/proxy.ts:232-250`; `apps/tenant_store/src/app/(tenant)/layout.tsx:52-59`; `apps/store_owner_dashboard/AGENTS.md:55-56`).
- Keep recovery and payment transitions resilient to redirects, refreshes, and duplicate work through single-flight refresh/payment creation and server-side webhook reconciliation (`apps/store_owner_dashboard/src/api/client.ts:86-120`; `apps/store_owner_dashboard/AGENTS.md:111-147`; `apps/api/src/modules/payments/webhooks/stripe-webhook.service.ts:197-283`).
- Provide tenant-specific storefront metadata and a public catalog surface suitable for discovery (`apps/tenant_store/AGENTS.md:1-4`; `apps/tenant_store/src/app/(tenant)/layout.tsx:19-44`).

## Current non-goals and boundaries

- Frontend role checks are not the security boundary; the API owns authorization and subscription enforcement (`apps/store_owner_dashboard/AGENTS.md:85-91`; `apps/api/src/app.module.ts:75-100`).
- The Super Admin console is platform-only and does not act as a tenant-scoped dashboard (`apps/super_admin_dashboard/AGENTS.md:22-26`).
- Recurring Stripe Billing and subscription resume/re-subscribe are outside the current implementation (`apps/api/AGENTS.md:359-368`; `apps/api/AGENTS.md:400-412`).
- Product-detail routing is numeric-id based rather than slug based (`apps/tenant_store/AGENTS.md:93-94`).

## Scope clarity

- The repository demonstrates implemented commerce capabilities, but actual production adoption, uptime, conversion targets, and customer research are **unknown**.
- A formal roadmap and prioritization source are **unknown**.
- For current app behavior and pitfalls, follow [API Payments](../apps/api/AGENTS.md#payments), [Tenant Dashboard Subscription](../apps/store_owner_dashboard/AGENTS.md#subscription), [Platform Scope](../apps/super_admin_dashboard/AGENTS.md#platform-scope), and [Storefront Routing](../apps/tenant_store/AGENTS.md#routing) rather than duplicating those rules here.
