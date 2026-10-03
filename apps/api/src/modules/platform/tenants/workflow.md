```mermaid
flowchart TD
    Client["SUPER_ADMIN"] --> GUARD["Platform pipeline: @Platform + @Roles SUPER_ADMIN<br/>see platform/workflow.md"]
    GUARD --> OP{"endpoint"}

    OP -->|"GET /platform/tenants"| L["PlatformTenantsService.listTenants"]
    L --> L1["TenantService.findAll<br/>tenants ordered by createdAt DESC"]
    L1 --> L2["TenantService.getSchemaSizes(schemaNames)<br/>→ schemaSizeBytes per tenant<br/>(missing schema or query failure → 0)<br/>+ schemaCapacityBytes (TENANT_DB_CAPACITY_BYTES)"]

    OP -->|"GET /platform/tenants/:id"| F["PlatformTenantsService.getTenant"]
    F --> F1["TenantService.findByIdWithOwner"]
    F1 --> F12{"tenant exists?"}
    F12 -->|"no"| E404["404 Tenant not found"]
    F12 -->|"yes"| F5["TenantService.getSchemaSizes([tenant.schemaName])<br/>→ schemaSizeBytes<br/>(missing schema or query failure → 0)<br/>+ schemaCapacityBytes (TENANT_DB_CAPACITY_BYTES)"]
    F12 -->|"yes"| F2{"ownerUserId set?"}
    F2 -->|"yes"| F3["TenantManagerService.getRepository(User, tenant)<br/>load owner with role + permissions<br/>(selects id, email, name, role, permissions only)"]
    F2 -->|"no"| F4["owner = null"]
    F3 --> OUT["tenant + owner + schemaSizeBytes + schemaCapacityBytes"]
    F4 --> OUT
    F5 --> OUT

    OP -->|"PATCH /platform/tenants/:id/toggle-active"| T["PlatformTenantsService.toggleActiveTenant"]
    T --> T1["TenantService.toggleActiveTenant"]
    T1 --> T2{"tenant exists?"} -->|"no"| T2E["404 Tenant not found"]
    T2 -->|"yes"| T3{"status ACTIVE?"}
    T3 -->|"yes"| T4["status = INACTIVE<br/>TenantManagerService.release(tenant)<br/>→ drop + destroy cached DataSource"]
    T3 -->|"no"| T5["status = ACTIVE<br/>(DataSource lazily re-created on next use)"]
```

`TenantService.getSchemaSizes()` (single `SUM(pg_total_relation_size)` query over all requested schemas) is wired into these platform endpoints as `schemaSizeBytes`: `listTenants` fetches every tenant then resolves all schema sizes in one call, and `getTenant` resolves the single tenant's schema. A missing schema entry or a failed query degrades `schemaSizeBytes` to `0` and logs a warning, so the endpoints keep rendering. `schemaCapacityBytes` accompanies it, read from `TENANT_DB_CAPACITY_BYTES` via `TenantService.getSchemaCapacityBytes()` (display-only, the same for every tenant). This is display-only: `storageUsedBytes` / `storageCapacityBytes` remain maintained incrementally by `TenantService.adjustStorageUsedBytes` during product image upload/delete and drive quota enforcement.
