```mermaid
flowchart TD
    subgraph STORE["Store owner — StoreCurrencyController /api/v1/store/currency<br/>tenant route, @Roles STORE_OWNER"]
        SO["Store owner (tenant token)"] --> SG["Global pipeline: TenantMiddleware, TenantGuard,<br/>JwtGuard, PermissionGuard<br/>see auth/workflow.md"]
        SG --> SRO{"route"}
        SRO -->|"GET /store/currency"| GET["getForTenant — current currency +<br/>pending request + last 10 requests"]
        SRO -->|"POST /store/currency/requests"| NEW["create — one PENDING per tenant"]
        SRO -->|"PATCH /store/currency/requests/:id/cancel"| CAN["cancel — own tenant, PENDING only"]
    end

    subgraph PLAT["Platform admin — PlatformCurrencyRequestsController<br/>/api/v1/platform/currency-requests, @Platform @Roles SUPER_ADMIN"]
        PA["SUPER_ADMIN (platform token)"] --> PG["Global pipeline, platform scope<br/>see platform/workflow.md"]
        PG --> PRO{"route"}
        PRO -->|"GET /platform/currency-requests?status="| LIST["list — all requests joined with<br/>tenant name / slug / currency"]
        PRO -->|"PATCH /platform/currency-requests/:id/approve"| APR["approve"]
        PRO -->|"PATCH /platform/currency-requests/:id/reject"| REJ["reject — reviewNote required"]
    end

    subgraph APP["Application — CurrencyRequestsService"]
        GET --> SVC
        NEW --> SVC
        CAN --> SVC
        LIST --> SVC
        APR --> SVC
        REJ --> SVC
        SVC --> TS["TenantService<br/>findAll / findById / updateCurrency"]
    end

    subgraph DATA["Data"]
        SVC --> PUB[("PostgreSQL public schema<br/>currency_change_requests<br/>partial unique index: one PENDING per tenantId")]
        TS --> TEN[("PostgreSQL public schema<br/>tenants.currency")]
    end
```

---

```mermaid
stateDiagram-v2
    [*] --> PENDING: store owner create
    PENDING --> CANCELLED: owner cancel
    PENDING --> APPROVED: platform approve (updates tenants.currency)
    PENDING --> REJECTED: platform reject (reviewNote required)
    APPROVED --> [*]
    REJECTED --> [*]
    CANCELLED --> [*]
    note right of PENDING
        Only one PENDING row per tenant is
        allowed (partial unique index + 23505 becomes 409).
        approve/reject/cancel all require PENDING,
        otherwise 409 Request has already been reviewed.
    end note
```

---

```mermaid
flowchart TD
    CREATE["create(tenant, actor, dto)"]
        C0{"dto.requestedCurrency == tenant.currency?"} -->|"yes"| C0E["400 Requested currency matches the current store currency"]
        C0 -->|"no"| C1{"pending request already exists?"} -->|"yes"| C1E["409 A pending currency change request already exists"]
        C1 -->|"no"| C2["insert row: PENDING, current/requested currency,<br/>requestedById + requestedByEmail snapshot, reason"]
        C2 --> C3{"unique violation 23505?"} -->|"yes"| C1E
        C3 -->|"no"| C4["return request"]

    APPROVE["approve(id, reviewerId)"]
        A1{"request exists?"} -->|"no"| A1E["404 Currency change request not found"]
        A1 -->|"yes"| A2{"status PENDING?"} -->|"no"| A2E["409 Request has already been reviewed"]
        A2 -->|"yes"| A3["TenantService.updateCurrency(tenantId, requestedCurrency)"]
        A3 --> A4["status = APPROVED, reviewedById + reviewedAt"]

    REJECT["reject(id, reviewerId, dto)"]
        R1{"reviewNote non-empty?"} -->|"no"| R1E["400 reviewNote is required when rejecting"]
        R1 -->|"yes"| R2{"request exists and PENDING?"} -->|"no"| R2E["404 / 409"]
        R2 -->|"yes"| R3["status = REJECTED, reviewNote, reviewer + reviewedAt"]

    CANCEL["cancel(tenant, requestId)"]
        X1{"request exists and tenantId matches?"} -->|"no"| X1E["404 Currency change request not found"]
        X1 -->|"yes"| X2{"status PENDING?"} -->|"no"| X2E["409 Only pending requests can be cancelled"]
        X2 -->|"yes"| X3["status = CANCELLED"]

    LIST["list(status?)"]
        L1["find requests (optionally filtered by status),<br/>newest first"] --> L2["TenantService.findAll,<br/>join tenant name / slug / currency"]
```

Changing a store's live currency requires platform approval: the store owner files a request, a SUPER_ADMIN applies it. The platform list endpoint is the only place that spans tenants; the store endpoints are always scoped to `req.tenant`.
