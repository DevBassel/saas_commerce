```mermaid
flowchart TD
    Client["SUPER_ADMIN"] --> GUARD["Platform pipeline: @Platform + @Roles SUPER_ADMIN<br/>see platform/workflow.md"]
    GUARD --> OP{"endpoint"}

    OP -->|"GET /platform/tenants"| L["TenantService.findAll<br/>tenants ordered by createdAt DESC"]
    L --> RESP["Response"]

    OP -->|"GET /platform/tenants/:id"| F["TenantService.findByIdWithOwner"]
    F --> F1{"tenant exists?"}
    F1 -->|"no"| E404["404 Tenant not found"]
    F1 -->|"yes"| F2{"ownerUserId set?"}
    F2 -->|"yes"| F3["TenantManagerService.getRepository(User, tenant)<br/>load owner with role + permissions<br/>(selects id, email, name, role, permissions only)"]
    F2 -->|"no"| F4["owner = null"]
    F3 --> OUT["tenant + owner"]
    F4 --> OUT
    OUT --> RESP
```
