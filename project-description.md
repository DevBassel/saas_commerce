### Multi-Tenant SaaS Commerce Platform — Backend API, Super Admin Console & Tenant Dashboard

- Architected a **schema-per-tenant SaaS commerce platform** using NestJS, TypeORM, and PostgreSQL, providing isolated `tenant_<slug>` schemas with tenant resolution via headers and subdomains.
- Built a **tenant-aware DataSource manager** with connection pooling, LRU caching, in-flight request deduplication, and automatic connection teardown to support scalable multi-tenant database access.
- Designed a **RBAC system** with granular permissions, hierarchical roles, super-admin privileges, and direct per-user permissions, with rank-based controls to prevent privilege escalation.
- Implemented **stateless JWT authentication** with separate access/refresh secrets, refresh-token rotation, JTI revocation, and tenant-bound claims to prevent cross-tenant token reuse.
- Automated the **tenant lifecycle**, including schema provisioning, RBAC/category seeding, boot-time tenant reseeding, and super-admin activation/deactivation with automatic DataSource and connection cleanup.
- Integrated **Stripe payment processing** with tenant-scoped payment workflows, payment status tracking, transaction handling, and controlled customer refunds through the Tenant Admin dashboard.
- Implemented **tenant-scoped Cloudflare R2 object storage** with per-tenant quotas, MIME/size validation, multi-file upload rollback, and PostgreSQL-based storage usage accounting for live capacity monitoring.
- Built a **Super Admin console** using React, TypeScript, Refine, React Router, shadcn/ui, and Tailwind CSS, supporting tenant provisioning, lifecycle management, RBAC inspection, and storage telemetry.
- Built the **Tenant Admin dashboard** with server-side pagination, sorting, category management, ordered product images, permission-aware staff administration, and authorized customer refund management.
