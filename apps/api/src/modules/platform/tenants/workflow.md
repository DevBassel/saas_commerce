```mermaid
flowchart TD
    Client["SUPER_ADMIN"] --> GUARD["Platform pipeline: @Platform + @Roles SUPER_ADMIN<br/>see platform/workflow.md"]
    GUARD --> OP{"endpoint"}

    OP -->|"GET /platform/tenants"| L["PlatformTenantsService.listTenants"]
    L --> L1["TenantService.findAll<br/>tenants ordered by createdAt DESC"]

    OP -->|"GET /platform/tenants/:id"| F["PlatformTenantsService.getTenant"]
    F --> F1["TenantService.findByIdWithOwner"]
    F1 --> F12{"tenant exists?"}
    F12 -->|"no"| E404["404 Tenant not found"]
    F12 -->|"yes"| F2{"ownerUserId set?"}
    F2 -->|"yes"| F3["TenantManagerService.getRepository(User, tenant)<br/>load owner with role + permissions<br/>(selects id, email, name, role, permissions only)"]
    F2 -->|"no"| F4["owner = null"]
    F3 --> OUT["tenant + owner"]
    F4 --> OUT

    OP -->|"PATCH /platform/tenants/:id/toggle-active"| T["PlatformTenantsService.toggleActiveTenant"]
    T --> T1["TenantService.toggleActiveTenant"]
    T1 --> T2{"tenant exists?"} -->|"no"| T2E["404 Tenant not found"]
    T2 -->|"yes"| T3{"status ACTIVE?"}
    T3 -->|"yes"| T4["status = INACTIVE<br/>TenantManagerService.release(tenant)<br/>→ drop + destroy cached DataSource"]
    T3 -->|"no"| T5["status = ACTIVE<br/>(DataSource lazily re-created on next use)"]
```

`TenantService.getSchemaSizes()` exists (single `SUM(pg_total_relation_size)` query per schema) but is no longer wired into these platform endpoints: `listTenants` returns the raw `Tenant` rows and `getTenant` returns tenant + owner only. `storageUsedBytes` / `storageCapacityBytes` are maintained incrementally by `TenantService.adjustStorageUsedBytes` during product image upload/delete.
