```mermaid
flowchart TD
    Client["Client (tenant dashboard)"] --> GUARDS["Global pipeline: TenantMiddleware, TenantGuard,<br/>JwtGuard, PermissionGuard<br/>see auth/workflow.md"]

    subgraph API["API — DashboardController /api/v1/dashboard"]
        GUARDS --> RO{"route"}
        RO -->|"GET /dashboard/stats<br/>needs orders:manage"| GS["getStats — eight card values in one request"]
    end

    subgraph APP["Application — DashboardService"]
        GS --> TRT{"tenant context<br/>(tenantStorage or arg)?"}
        TRT -->|"none"| TRTE["403 Tenant context required"]
        TRT -->|"resolved"| TM["TenantManagerService.getRepository<br/>Order, User"]
        TM --> CNT["orderRepo.count()<br/>+ count(DELIVERED) → fulfilledOrders<br/>+ count(PENDING) → pendingOrders"]
        TM --> CUS["userRepo query builder:<br/>innerJoin role, role.key = CUSTOMER<br/>getCount() → customers"]
        TM --> TEN["TenantService.findBySchemaName(target.schemaName)<br/>→ storageUsedBytes / storageCapacityBytes"]
        TM --> BAL["StripePaymentService.getBalance<br/>(tenant stripeAccountId)<br/>available → totalPaid<br/>pending → waitingAmount"]
    end

    subgraph DATA["Data"]
        CNT --> TDB[("PostgreSQL tenant schema<br/>orders, users, roles")]
        CUS --> TDB
        TEN --> PUB[("PostgreSQL public schema<br/>tenants")]
        BAL --> SA[("Stripe API — connected<br/>account balance")]
    end
```

---

```mermaid
flowchart TD
    GS["getStats(tenant?)"]
        G0["resolve tenant (arg or AsyncLocalStorage)"] --> G1{"resolved?"}
        G1 -->|"no"| G1E["403 Tenant context required"]
        G1 -->|"yes"| G2["Promise.all: Order repo + User repo<br/>for the tenant schema,<br/>+ TenantService.findBySchemaName"]
        G2 --> G3["Promise.all: three order counts,<br/>customer count, Stripe balance"]
        G3 --> G4["totalPaid / waitingAmount:<br/>sum available / pending cents then / 100,<br/>round2 (missing account or outage → 0)"]
        G4 --> G5["plain JSON DashboardStats:<br/>totalOrders, fulfilledOrders, pendingOrders,<br/>totalPaid, waitingAmount, customers,<br/>storageUsedBytes, storageCapacityBytes<br/>(no envelope, no writes)"]
```

Stripe failures never fail the endpoint: a missing/disconnected account or a Stripe outage degrades `totalPaid` and `waitingAmount` to `0` and logs a warning, so the rest of the dashboard still renders.
