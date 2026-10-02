```mermaid
flowchart TD
    Client["Client (tenant user)"] --> GUARDS["Global pipeline: TenantMiddleware, TenantGuard,<br/>JwtGuard, PermissionGuard<br/>see auth/workflow.md"]

    subgraph API["API — AddressesController /api/v1/addresses"]
        GUARDS --> RO{"route"}
        RO -->|"GET /addresses<br/>needs addresses:read"| FA["findAll — own addresses only,<br/>default first (isDefault DESC, createdAt ASC, id ASC)"]
        RO -->|"GET /addresses/:id<br/>needs addresses:read"| FO["findOne — scoped by userId, 404 for non-owner"]
        RO -->|"POST /addresses<br/>needs addresses:create"| CR["create — max 20, default handling"]
        RO -->|"PATCH /addresses/:id/default<br/>needs addresses:update"| SD["setDefault — clears the previous default"]
        RO -->|"PATCH /addresses/:id<br/>needs addresses:update"| UP["update — partial patch, never changes isDefault"]
        RO -->|"DELETE /addresses/:id<br/>needs addresses:delete"| RM["remove — promotes the oldest remaining<br/>address when the default is deleted"]
    end

    subgraph APP["Application — AddressesService"]
        SVC["All methods"] --> TRT{"tenant context<br/>(tenantStorage or arg)?"}
        TRT -->|"none"| TRTE["403 Tenant context required"]
        TRT -->|"resolved"| TM["TenantManagerService.getRepository<br/>Address (tenant schema only)"]
    end

    subgraph DATA["Data"]
        TM --> TDB[("PostgreSQL tenant schema<br/>addresses<br/>partial unique index: one isDefault per userId")]
    end
```

---

```mermaid
flowchart TD
    CREATE["create(userId, dto)<br/>transaction + retry once on 23505"]
        C0{"count(userId) >= MAX_ADDRESSES (20)?"} -->|"yes"| C0E["400 Cannot save more than 20 addresses"]
        C0 -->|"no"| C1["isDefault = count == 0 OR dto.isDefault"]
        C1 --> C2{"isDefault AND count > 0?"}
        C2 -->|"yes"| C3["clear isDefault on all of the user's addresses"]
        C2 -->|"no"| C4["insert address<br/>country = dto.country.toUpperCase()"]
        C3 --> C4
        C4 --> C5["serialize (line2/state/label null-coalesced)"]

    SETDEFAULT["setDefault(userId, id)"]
        S0{"own address exists?"} -->|"no"| S0E["404 Address not found"]
        S0 -->|"yes"| S1{"already default?"} -->|"yes"| S2["return it"]
        S1 -->|"no"| S3["clear default for user,<br/>then set isDefault on target"]

    REMOVE["remove(userId, id)"]
        R0{"own address exists?"} -->|"no"| R0E["404 Address not found"]
        R0 -->|"yes"| R1["delete address"]
        R1 --> R2{"deleted was default?"}
        R2 -->|"no"| R4["done"]
        R2 -->|"yes"| R3{"another address exists?"}
        R3 -->|"no"| R4
        R3 -->|"yes"| R5["promote oldest remaining<br/>(createdAt ASC, id ASC) to default"]

    UPDATE["update(userId, id, dto)"]
        U0{"own address exists?"} -->|"no"| U0E["404 Address not found"]
        U0 -->|"yes"| U1["patch only defined fields<br/>country uppercased, line2/state/label -> null when cleared"]
        U1 --> U2["apply patch when non-empty, then findOne"]
```

`withUniqueRetry` re-runs the whole transaction once when PostgreSQL returns `23505`, so two concurrent requests racing for the single default row settle to one winner instead of failing. All reads and mutations are scoped to `request.user.id`; a user can never see or change another user's address.
