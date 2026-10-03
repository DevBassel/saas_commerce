```mermaid
flowchart TD
    Client["Client (tenant user with RBAC permissions)"] --> GUARDS["Global pipeline<br/>see auth/workflow.md"]

    subgraph API["API"]
        GUARDS --> RC["RolesController /api/v1/roles"]
        GUARDS --> PC["PermissionsController /api/v1/permissions"]
        RC --> RC1["GET /roles, GET /roles/:id needs roles:read<br/>POST needs roles:create<br/>PATCH needs roles:update<br/>DELETE (204) needs roles:delete"]
        PC --> PC1["GET /permissions (ordered by key) needs permissions:read<br/>POST needs permissions:create<br/>PATCH needs permissions:update<br/>DELETE (204) needs permissions:delete"]
    end

    RC1 --> SVC["RbacService"]
    PC1 --> SVC

    subgraph APP["Application — RbacService"]
        SVC --> TRT{"tenant argument or<br/>tenantStorage context?"}
        TRT -->|"resolved"| TM["TenantManagerService.getRepository<br/>Role, Permission"]
        TRT -->|"none"| DEF["403 Tenant context is required<br/>(no public-schema fallback)"]
    end

    subgraph DATA["Data"]
        TM --> TDB[("tenant schema<br/>roles, role_permissions, permissions")]
    end
```

RBAC routes are tenant-scoped only: platform roles/permissions (including `SUPER_ADMIN`) are seeded at bootstrap and are not editable through these controllers.

---

```mermaid
flowchart TD
    subgraph RROLE["Role operations (SYSTEM_ROLES = SUPER_ADMIN, STORE_OWNER, ADMIN, CUSTOMER)"]
        CR["createRole"] --> CR1{"key in SYSTEM_ROLES?"}
        CR1 -->|"yes"| CR1E["409 Role key is reserved"]
        CR1 -->|"no"| CR2{"key already exists?"}
        CR2 -->|"yes"| CR2E["409 Role key already exists"]
        CR2 -->|"no"| CR3["save role (isSystem defaults false)"]
        UR["updateRole"] --> UR1{"role exists?"} -->|"no"| UR1E["404 Role not found"]
        UR1 -->|"yes"| UR2{"key changed?"}
        UR2 -->|"no"| UR4["apply name / description and save"]
        UR2 -->|"yes"| UR3{"role.isSystem or key reserved<br/>or key already taken?"} -->|"yes"| UR3E["409 Conflict"]
        UR3 -->|"no"| UR4
        DR["removeRole"] --> DR1{"role exists?"} -->|"no"| DR1E["404 Role not found"]
        DR1 -->|"yes"| DR2{"role.isSystem or system key?"} -->|"yes"| DR2E["409 System roles cannot be deleted"]
        DR2 -->|"no"| DR3["delete role"]
    end

    subgraph RPERM["Permission operations"]
        CP["createPermission"] --> CP1{"key already exists?"} -->|"yes"| CP1E["409 Permission key already exists"]
        CP1 -->|"no"| CP2["save permission"]
        UP["updatePermission"] --> UP1{"permission exists?"} -->|"no"| UP1E["404 Permission not found"]
        UP1 -->|"yes"| UP2{"key changed and taken?"} -->|"yes"| UP2E["409 Permission key already exists"]
        UP2 -->|"no"| UP3["save merged fields"]
        DP["removePermission"] --> DP1{"permission exists?"} -->|"no"| DP1E["404 Permission not found"]
        DP1 -->|"yes"| DP2["delete permission"]
    end
```

---

```mermaid
flowchart TD
    BOOT["Application bootstrap<br/>SeedingBootstrapService"] --> SEED["platform seeder 'permissions'<br/>upsertPermissions on public DataSource"]
    SEED --> S1["upsert all SEED_PERMISSIONS (45) by key:<br/>users (6), roles/permissions (8), products (4),<br/>categories (4), cart (4), orders (5), coupons (5),<br/>payments (3), addresses (4), subscriptions (2)"]
    S1 --> S2["platform seeder 'roles'<br/>upsert SUPER_ADMIN role isSystem = true<br/>linked to ALL 45 permissions"]
    S2 --> E0["platform seeder 'super-admin'<br/>ensureBootstrapSuperAdmin"]
    E0 --> E1{"SUPER_ADMIN role found?"} -->|"no"| SKIP["return (nothing to do)"]
    E1 -->|"yes"| E2{"count of SUPER_ADMIN users?"}
    E2 -->|"more than 0"| SKIP2["skip bootstrap"]
    E2 -->|"0"| E3{"BOOTSTRAP_SUPER_ADMIN_EMAIL<br/>and PASSWORD configured?"}
    E3 -->|"no"| FAIL["throw Error — app refuses to boot<br/>without a platform super admin"]
    E3 -->|"yes"| E4{"user with bootstrap email<br/>already exists?"}
    E4 -->|"yes"| E5["grant SUPER_ADMIN role<br/>+ merge ALL permissions (password kept)"]
    E4 -->|"no"| E6["create SUPER_ADMIN user<br/>bcrypt hash (BCRYPT_ROUNDS or 12)<br/>emailVerified = true, all permissions"]
```

Boot seeding is owned by `SeedingBootstrapService` (`src/modules/seeding/`), which runs the
platform seeder registry then the tenant seeder registry for every ACTIVE tenant. It is skipped when
`SEED_CLI=true` so the CLI (`test/seed.ts`) can drive `SeedingService` directly. All RBAC seed logic
lives in `src/modules/seeding/helpers/rbac.seed.ts`.

---

```mermaid
flowchart TD
    PROV["TenantProvisionerService.provision<br/>or tenant seeder 'roles'"] --> TSEED["seedRbac / upsertRoles on the tenant DataSource<br/>roles = STORE_OWNER, ADMIN, CUSTOMER"]
    TSEED --> P["upsert every SEED_PERMISSIONS by key"]
    P --> R["upsert each tenant role (isSystem = true)<br/>and replace its permission set with SEED_ROLE_PERMISSIONS[key]"]
    R --> MATRIX["STORE_OWNER → all 45 permissions<br/>ADMIN → operational subset<br/>CUSTOMER → catalog read, own cart,<br/>own orders + cancel/return, own payments, own addresses"]
```

`UsersService.create` and `assignRole` re-attach `SEED_ROLE_PERMISSIONS[roleKey]` as **direct** `user_permissions`; custom roles map to `[]`. Seeding is idempotent and conflict-safe (upsert by unique `key`), so it never deletes tenant-created permissions.
