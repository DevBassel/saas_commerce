```mermaid
flowchart TD
    REQ["Incoming request<br/>headers: x-tenant-id / x-tenant-slug / host"] --> ISRQ{"isApiPath?<br/>/api/v1 prefix"}
    ISRQ -->|"no"| NONE["no resolution"]
    ISRQ -->|"yes"| HID{"x-tenant-id header?"}
    HID -->|"present"| BYID["TenantService.findById"]
    BYID -->|"not found"| UNDEF["undefined"]
    BYID -->|"found"| TEN["Tenant"]
    HID -->|"absent"| HSL{"x-tenant-slug header?"}
    HSL -->|"present"| BYSLUG["TenantService.findBySlug"]
    BYSLUG -->|"not found"| UNDEF
    BYSLUG -->|"found"| TEN
    HSL -->|"absent"| SUB{"subdomain in host?<br/>host minus APP_ROOT_DOMAIN"}
    SUB -->|"present"| BYSUB["TenantService.findBySubdomain"]
    BYSUB -->|"not found"| UNDEF
    BYSUB -->|"found"| TEN
    SUB -->|"absent"| UNDEF
    TEN --> OUT["TenantMiddleware: req.tenant + tenantStorage context<br/>TenantGuard: 400 missing identifier / 404 unresolved /<br/>403 INACTIVE, else request.tenant"]
```

Resolution order is `x-tenant-id` → `x-tenant-slug` → subdomain (`resolveSubdomain`: host stripped of port and `APP_ROOT_DOMAIN`). The `Host` path is what lets tenant dashboards (`my-store.localhost:5174`) and the storefront (`my-store.localhost:3000`) resolve without headers.

---

```mermaid
flowchart TD
    REG["AuthService.registerStore"] --> TC["TenantService.create<br/>name, slug, subdomain = slug<br/>schemaName = buildSchemaName(slug) = tenant_slug<br/>storageCapacityBytes = TENANT_STORAGE_CAPACITY_BYTES"]
    TC --> TC1{"schemaName already exists?"} -->|"yes"| TC1E["409 Schema name already exists"]
    TC1 -->|"no"| TC2{"schemaName.length >= 63?"} -->|"yes"| TC2W["warn: truncated slugs can collide"]
    TC2 --> PROV["TenantProvisionerService.provision"]
    TC2W --> PROV
    PROV --> SAN["sanitizeSchemaName<br/>lowercase, a-z 0-9 underscore, max 63 chars"]
    SAN --> DDL["CREATE SCHEMA IF NOT EXISTS<br/>via public DataSource"]
    DDL --> GDS["TenantManagerService.getDataSource"]
    GDS --> SEED["seedRbac on tenant DataSource<br/>TENANT_ROLE_KEYS: STORE_OWNER, ADMIN, CUSTOMER + permissions<br/>(no base categories; the 'categories' seeder is opt-in)"]
    SEED --> DONE["log: Provisioned tenant slug (schema)"]

    subgraph MGR["TenantManagerService — per-schema DataSource cache (cap 100, LRU)"]
        GA["getDataSource(tenant)"] --> CH{"cached DataSource?"}
        CH -->|"yes"| REFRESH["LRU refresh (re-insert)<br/>and return it"]
        CH -->|"no"| INF{"in-flight promise<br/>for same schema?"}
        INF -->|"yes"| WAIT["await and return the same promise"]
        INF -->|"no"| NEW["new DataSource<br/>schema override, TENANT_ENTITIES,<br/>synchronize = DB_SYNCHRONIZE AND<br/>(NODE_ENV != production OR DB_SYNCHRONIZE_TENANTS),<br/>poolSize = TENANT_POOL_SIZE"]
        NEW --> INIT["initialize(); if cache >= cap,<br/>destroy oldest entry; cache.set"]
        INIT --> RET["return DataSource"]
        REL["release(tenant) — drop from cache<br/>and destroy the DataSource"]
        DEST["onModuleDestroy — destroy<br/>all cached DataSources"]
    end

    GDS --> GA
    RET --> SEED
```

---

```mermaid
flowchart TD
    subgraph READS["TenantService reads"]
        LIST["findAll — tenants ordered by createdAt DESC"]
        GETID["findById — 404 Tenant not found when missing"]
        GETOWN["findByIdWithOwner — tenant + owner<br/>(owner role + permissions, selected fields)"]
        LOOKUP["findBySlug / findBySchemaName / findBySubdomain /<br/>findByStripeAccountId"]
        SIZES["getSchemaSizes(schemas)<br/>SUM(pg_total_relation_size) per pg_namespace"]
        DBCAP["getSchemaCapacityBytes()<br/>TENANT_DB_CAPACITY_BYTES (display-only schema cap)"]
    end

    subgraph WRITES["TenantService writes"]
        CREATE["create(dto) — schemaName uniqueness + capacity from env"]
        OWNER["setOwnerUserId(id, ownerUserId)"]
        TOGGLE["toggleActiveTenant(id)"]
        TOGGLE --> T1{"status ACTIVE?"}
        T1 -->|"yes"| T2["status = INACTIVE + TenantManager.release(tenant)"]
        T1 -->|"no"| T3["status = ACTIVE"]
        CURRENCY["updateCurrency(id, currency)"]
        CONTROLS["updatePaymentControls(id, { paymentsPaused,<br/>payoutsPaused, stripePayoutsInterval })"]
        STRIPE["updateStripeAccountState(id, { stripeAccountId,<br/>stripeChargesEnabled, stripePayoutsEnabled, stripeDetailsSubmitted })"]
        STORAGE["adjustStorageUsedBytes(schemaName, deltaBytes)<br/>transaction + pessimistic_write on tenant:<br/>clamp below 0 to 0, > capacity -> 400 Storage capacity exceeded"]
    end
```

`storageCapacityBytes` is set at tenant creation from `TENANT_STORAGE_CAPACITY_BYTES`; `storageUsedBytes` is then maintained incrementally by `adjustStorageUsedBytes` on every product image upload/delete (never recomputed from `pg_total_relation_size` in normal operation).
