## **Multi-Tenant SaaS Commerce Platform |** API, Admin Console, Tenant Dashboard, Storefront | [github.com/DevBassel/saas_commerce](https://github.com/DevBassel/saas_commerce)

- Architected a schema-per-tenant platform with **NestJS, TypeORM, and PostgreSQL**, providing isolated tenant schemas with header/subdomain-based tenant resolution.
- Built a **DataSource manager** with connection pooling, LRU caching, request deduplication, and automatic connection cleanup.
- Designed **RBAC and JWT authentication** with hierarchical roles, granular permissions, direct user grants, and **refresh token rotation**.
- Integrated **Stripe Connect destination charges** with per-tenant **Express onboarding** and platform application fees.
- Automated **refunds** for order cancellation and returns, reconciled through signature-verified, idempotent webhooks.
- Implemented **Cloudflare R2 storage** with tenant quotas, file validation, upload rollback, and usage tracking.
- Built a **multi-tenant subscription system** with configurable plans, feature limits, usage tracking, tenant assignment, and server-side entitlement enforcement.
- Built **Super Admin and Tenant dashboards** with React, TypeScript, Refine, shadcn/ui, and Tailwind CSS for tenant, catalog, RBAC, storage, and payment management.
- Built the **Next.js customer storefront** with subdomain tenant resolution, NextAuth credentials login, catalog, cart, Stripe Checkout, and customer order self-service for cancellations and returns.
