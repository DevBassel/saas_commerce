```mermaid
flowchart TD
    Client["Platform admin client<br/>SUPER_ADMIN access token without tenant claims"] --> TG{"TenantGuard"}
    TG -->|"@Platform() route — skip"| JG{"JwtGuard"}
    JG -->|"token carries tenant claims"| E403T["403 Platform routes require a platform token"]
    JG -->|"valid platform access token"| LOAD["load user from public schema<br/>role + permissions"]
    LOAD --> PG{"PermissionGuard<br/>@Roles [SUPER_ADMIN]"}
    PG -->|"not SUPER_ADMIN"| E403R["403 You are not allowed to access this resource"]
    PG -->|"SUPER_ADMIN"| CTRL{"PlatformModule controller<br/>/api/v1/platform/..."}

    subgraph TENANTS["PlatformTenantsController /platform/tenants"]
        CTRL -->|"GET /platform/tenants<br/>GET /platform/tenants/:id<br/>PATCH /platform/tenants/:id/toggle-active"| TSVC["PlatformTenantsService<br/>delegates to TenantService"]
    end

    subgraph PAYMENTS["PlatformPaymentsController /platform/payments"]
        CTRL -->|"GET /platform/payments<br/>GET /platform/payments/summary<br/>GET /platform/payments/:tenantId"| PSVC["PlatformPaymentsService"]
        CTRL -->|"GET /:tenantId/charges, GET /:tenantId/payouts<br/>PATCH /:tenantId/payments-paused<br/>PATCH /:tenantId/payouts-paused"| PSVC
    end

    subgraph CURRENCY["PlatformCurrencyRequestsController /platform/currency-requests"]
        CTRL -->|"GET /platform/currency-requests<br/>PATCH /:id/approve, PATCH /:id/reject"| CSVC["CurrencyRequestsService"]
    end

    TSVC --> CORE["TenantService<br/>tenant lifecycle in public schema"]
    PSVC --> CORE
    PSVC --> SPR["StripePaymentService<br/>platform + connected-account reads"]
    PSVC --> TMGR["TenantManagerService.getRepository(Payment)<br/>per-tenant charges"]
    CSVC --> CORE

    CORE --> PDB[("PostgreSQL public schema<br/>tenants, currency_change_requests")]
    TMGR --> TDB[("PostgreSQL tenant schema<br/>payments")]
    SPR --> STRIPE[("Stripe API<br/>account, balance, payouts")]
```

Platform scope is tenant lifecycle, platform-level payment oversight, and currency-change review. Tenant users, roles, permissions, products, carts, orders and addresses remain tenant-admin territory; `PlatformCurrencyRequestsController.approve` is the only platform write that mutates a tenant's live configuration (`tenants.currency`).
