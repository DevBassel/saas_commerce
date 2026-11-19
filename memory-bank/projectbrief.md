# Project Brief

## Purpose

SaaS Commerce is a private pnpm monorepo for a multi-tenant commerce platform. Its declared scope is a schema-isolated API, platform administration, tenant administration, and a customer storefront (`project-description.md:1-11`; `package.json:1-16`). Treat `project-description.md` as product/portfolio intent; current source and package manifests are the implementation authority.

## Implemented system boundary

- **API:** a NestJS application composes auth, tenant/platform, catalog, cart, order, coupon, payment, storefront, subscription, and seeding modules (`apps/api/src/app.module.ts:56-74`).
- **Platform console:** the Super Admin SPA exposes tenant, payment, currency-request, and subscription-plan operations (`apps/super_admin_dashboard/src/App.tsx:134-177`).
- **Tenant console:** the Store Owner SPA exposes catalog, coupons, orders, users, payments, store settings, and subscription settings (`apps/store_owner_dashboard/src/App.tsx:111-175`).
- **Public experience:** the Next.js app separates platform/apex and tenant storefront contexts in its request proxy and root layouts (`apps/tenant_store/src/proxy.ts:132-250`; `apps/tenant_store/src/app/(tenant)/layout.tsx:47-95`; `apps/tenant_store/src/app/(platform)/layout.tsx:31-86`).

## Core architectural outcomes

- Tenant data uses schema-specific TypeORM data sources and a bounded, deduplicated data-source cache (`apps/api/src/modules/tenants/services/tenant-manager.service.ts:9-45`; `apps/api/src/modules/tenants/services/tenant-manager.service.ts:71-96`).
- Public-schema and tenant-schema entity registrations are intentionally separate (`apps/api/src/core.module.ts:27-42`; `apps/api/src/modules/tenants/utils/tenant-entities.ts:18-34`).
- The API is the authorization and entitlement boundary; its global guards run before controller work (`apps/api/src/app.module.ts:75-100`).
- Customer and tenant-admin clients preserve tenant context, while the platform console remains platform-scoped (`apps/tenant_store/src/proxy.ts:33-46`; `apps/store_owner_dashboard/src/api/client.ts:61-75`; `apps/super_admin_dashboard/src/api/client.ts:51-62`).

## Evidence boundaries and unknowns

- Cross-app contract authority is **unknown**: every app-level `AGENTS.md` points to a root `AGENTS.md`, but that root file is absent (`apps/api/AGENTS.md:6-7`; `apps/store_owner_dashboard/AGENTS.md:6-6`; `apps/super_admin_dashboard/AGENTS.md:7-7`; `apps/tenant_store/AGENTS.md:6-6`).
- A root `compose.yaml` is absent. The canonical root Compose entry point is therefore **unknown**; the only inspected Compose topology is `apps/docker-compose.yml` (`apps/docker-compose.yml:1-48`).
- Production hosting, SLOs, release cadence, and formal product acceptance criteria are **unknown**.

## Operating references

Do not restate app-specific rules here. Use the authoritative app documents:

- [API architecture and commands](../apps/api/AGENTS.md#commands)
- [Store Owner Dashboard](../apps/store_owner_dashboard/AGENTS.md#commands)
- [Super Admin Dashboard](../apps/super_admin_dashboard/AGENTS.md#commands)
- [Tenant Store](../apps/tenant_store/AGENTS.md#commands)
