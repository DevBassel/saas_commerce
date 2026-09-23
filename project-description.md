**Multi-Tenant SaaS Commerce Platform | API, Admin Console, Tenant Dashboard, Tenant Store**

- Architected a schema-per-tenant SaaS platform using **NestJS, TypeORM, and PostgreSQL**, providing isolated tenant schemas with header/subdomain-based tenant resolution.
- Built a **Data Source Manager** with connection pooling, LRU caching, request deduplication, and automatic connection cleanup.
- Designed **RBAC and JWT authentication** with hierarchical roles, granular permissions, direct user grants, token rotation, revocation, and tenant-bound claims.
- Integrated **Stripe payments**, enabling tenants to securely manage customer refunds from the Tenant Admin dashboard.
- Implemented **Cloudflare R2 storage** with tenant quotas, file validation, upload rollback, and usage tracking.
- Built **Super Admin and Tenant dashboards** with **React, TypeScript, Refine, shadcn/ui, and Tailwind CSS** for tenant, catalog, RBAC, storage, and payment management.
