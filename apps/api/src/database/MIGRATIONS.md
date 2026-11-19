# TypeORM Migrations

This API has two independent migration tracks:

- Platform migrations run in the `public` schema and record history in `public.platform_migrations`.
- Tenant migrations run independently in every registered `tenant_<slug>` schema and record history in that schema's `tenant_migrations` table.

Application startup never runs migrations. `synchronize` and `migrationsRun` are always disabled. Run migrations once as a deployment job before starting or updating API replicas.

## Prerequisites

- PostgreSQL is reachable using the `DB_*` variables in `apps/api/.env`.
- `DB_SYNCHRONIZE=false`.
- `DB_SYNCHRONIZE_TENANTS=false`.
- Dependencies are installed with `pnpm install` from the repository root.
- Production commands use a completed `pnpm --filter saas_store_api build`.

## Fresh Database

From the repository root, initialize the platform schema first:

```powershell
pnpm --filter saas_store_api migration:run:platform
```

Then migrate all tenants already registered in `public.tenants`:

```powershell
pnpm --filter saas_store_api migration:run:tenants
```

The combined command runs both steps in that order:

```powershell
pnpm --filter saas_store_api migration:run
```

On a completely fresh database there are no registered tenants yet, so the tenant phase processes zero schemas. Store registration creates the tenant record as inactive, runs tenant migrations, seeds tenant RBAC, completes owner setup, and only then activates the tenant.

## Production Deployment

Build the API image or application, then run exactly one migration job:

```powershell
pnpm --filter saas_store_api build
pnpm --filter saas_store_api migration:run:prod
```

After that job succeeds, start the API replicas:

```powershell
pnpm --filter saas_store_api start:prod
```

Do not add migration execution to Nest bootstrap or to every replica's startup command. The migration runner uses PostgreSQL advisory locks, but deployment orchestration should still have one migration owner.

## Tenant Migrations

Run migrations for every registered tenant:

```powershell
pnpm --filter saas_store_api migration:run:tenants
```

Run one registered tenant schema:

```powershell
pnpm --filter saas_store_api migration:run:tenants -- --tenant tenant_acme
```

The schema must:

- Start with `tenant_`.
- Contain only lowercase letters, digits, and underscores.
- Exist in the platform `tenants` registry.

The runner creates the schema when the registered tenant is being provisioned, prevents concurrent execution for the same tenant, closes any cached runtime DataSource before migration, and uses a short-lived single-connection migration DataSource.

## Migration Status

Show pending platform migrations:

```powershell
pnpm --filter saas_store_api migration:show:platform
```

Show pending migrations for one tenant:

```powershell
$env:TYPEORM_TENANT_SCHEMA="tenant_acme"
pnpm --filter saas_store_api migration:show:tenant
```

For Bash-compatible shells:

```bash
TYPEORM_TENANT_SCHEMA=tenant_acme pnpm --filter saas_store_api migration:show:tenant
```

## Generate Migrations

Generate a platform migration after changing a platform entity:

```powershell
pnpm --filter saas_store_api migration:generate:platform
```

Generate a tenant migration by comparing against an existing tenant schema:

```powershell
$env:TYPEORM_TENANT_SCHEMA="tenant_acme"
pnpm --filter saas_store_api migration:generate:tenant
```

After generation:

1. Rename `Generated` to a descriptive migration class and filename.
2. Confirm it is in `migrations/platform` or `migrations/tenant`.
3. Review every `up` and `down` statement.
4. For tenant SQL, replace the generation schema qualifier with `"__tenant_schema__"` where practical. `TenantMigrationDataSource` also rebinds generated `"tenant_*".` qualifiers at execution.
5. Never include a real tenant's data in a migration.
6. Run the migration verification script and the API build.

Do not move a tenant entity into the platform registry. Platform entities are explicitly listed in `platform-entities.ts`; tenant entities are explicitly listed in `modules/tenants/utils/tenant-entities.ts`.

## Verification

The verification script creates isolated temporary schemas, runs the platform baseline and two independent tenant baselines, checks entity/schema parity, verifies tenant isolation, reruns migrations to prove idempotency, and removes only the schemas it created.

```powershell
pnpm --filter saas_store_api migration:verify
pnpm --filter saas_store_api build
```

Expected final verification message:

```text
Verified platform baseline, two isolated tenant baselines, schema parity, and idempotent reruns
```

## Existing Databases

The initial platform and tenant migrations are baselines for fresh schemas. Do not run them directly against tables previously created by TypeORM `synchronize`; they will attempt to create tables that already exist.

Before adopting migrations on an existing database:

1. Take and verify a backup.
2. Compare the existing platform and every tenant schema with the initial migrations.
3. Resolve all schema drift.
4. Baseline the corresponding migration history tables only after exact parity is proven.
5. Test the process on a restored copy before production.

There is intentionally no automatic fake-history or destructive conversion command.

## Failure And Rollback

- A failed platform migration exits non-zero and API replicas must not be deployed.
- A failed tenant migration exits non-zero and tenant registration or reactivation does not mark that tenant active.
- Migrations run with transaction mode `each`, so each migration is atomic when all of its PostgreSQL statements are transactional.
- Re-running the runner is safe; TypeORM skips migration names already present in the relevant history table.
- Migration classes include `down` methods, but no production revert script is provided intentionally. Rollback must be reviewed, backed up, and executed during a controlled maintenance operation.

Never edit an already-applied migration. Add a new migration instead.
