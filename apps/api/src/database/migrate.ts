import 'reflect-metadata';
import { QueryRunner } from 'typeorm';
import { createDatabaseConfig } from './database-config';
import {
  assertTenantSchemaName,
  buildPlatformDataSourceOptions,
} from './data-source-options';
import { TenantManagerService } from '../modules/tenants/services/tenant-manager.service';
import { TenantMigrationService } from '../modules/tenants/services/tenant-migration.service';
import { DataSource } from 'typeorm';

type MigrationScope = 'all' | 'platform' | 'tenants';

const argumentValue = (name: string): string | undefined => {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
};

const parseScope = (): MigrationScope => {
  const scope = argumentValue('--scope') ?? 'all';
  if (scope !== 'all' && scope !== 'platform' && scope !== 'tenants') {
    throw new Error(`Invalid migration scope: ${scope}`);
  }
  return scope;
};

const withAdvisoryLock = async <T>(
  queryRunner: QueryRunner,
  lockName: string,
  work: () => Promise<T>,
): Promise<T> => {
  await queryRunner.connect();
  await queryRunner.query('SELECT pg_advisory_lock(hashtextextended($1, 0))', [
    lockName,
  ]);
  let operationError: unknown;
  let result: { value: T } | undefined;
  try {
    result = { value: await work() };
  } catch (error) {
    operationError = error;
  }

  const cleanupErrors: unknown[] = [];
  try {
    await queryRunner.query(
      'SELECT pg_advisory_unlock(hashtextextended($1, 0))',
      [lockName],
    );
  } catch (error) {
    cleanupErrors.push(error);
  }
  try {
    await queryRunner.release();
  } catch (error) {
    cleanupErrors.push(error);
  }

  const cleanupError =
    cleanupErrors.length > 0
      ? new AggregateError(
          cleanupErrors,
          `Migration lock cleanup failed for ${lockName}`,
        )
      : undefined;
  if (operationError) {
    if (cleanupError) console.error(cleanupError);
    throw operationError instanceof Error
      ? operationError
      : new Error('Non-Error migration failure', { cause: operationError });
  }
  if (cleanupError) throw cleanupError;
  if (!result) throw new Error(`Migration produced no result for ${lockName}`);
  return result.value;
};

const run = async (): Promise<void> => {
  const scope = parseScope();
  const requestedTenant = argumentValue('--tenant');
  if (requestedTenant && scope === 'platform') {
    throw new Error('--tenant cannot be used with --scope platform');
  }

  const config = createDatabaseConfig();
  const platformDataSource = new DataSource(
    buildPlatformDataSourceOptions(config),
  );
  const tenantManager = new TenantManagerService(config);

  await platformDataSource.initialize();
  try {
    if (scope === 'all' || scope === 'platform') {
      const migrations = await withAdvisoryLock(
        platformDataSource.createQueryRunner(),
        'saas-commerce:platform-migrations',
        () => platformDataSource.runMigrations({ transaction: 'each' }),
      );
      const names = migrations.map((migration) => migration.name);
      console.log(
        names.length > 0
          ? `Platform executed migrations: ${names.join(', ')}`
          : 'Platform is already up to date',
      );
    }

    if (scope === 'all' || scope === 'tenants') {
      const schemas = requestedTenant
        ? await registeredTenantSchema(platformDataSource, requestedTenant)
        : (
            await platformDataSource.query<Array<{ schemaName: string }>>(
              'SELECT "schemaName" FROM "public"."tenants" ORDER BY "id"',
            )
          ).map((tenant) => assertTenantSchemaName(tenant.schemaName));

      const tenantMigrations = new TenantMigrationService(
        tenantManager,
        platformDataSource,
      );
      for (const schemaName of schemas) {
        await tenantMigrations.migrate(schemaName);
      }
      console.log(`Tenant migrations complete for ${schemas.length} schema(s)`);
    }
  } finally {
    await tenantManager.onModuleDestroy();
    if (platformDataSource.isInitialized) await platformDataSource.destroy();
  }
};

const registeredTenantSchema = async (
  platformDataSource: DataSource,
  requestedSchema: string,
): Promise<string[]> => {
  const schemaName = assertTenantSchemaName(requestedSchema);
  const rows = await platformDataSource.query<Array<{ schemaName: string }>>(
    'SELECT "schemaName" FROM "public"."tenants" WHERE "schemaName" = $1',
    [schemaName],
  );
  if (rows.length === 0) {
    throw new Error(`Tenant schema is not registered: ${schemaName}`);
  }
  return [schemaName];
};

run().catch((error: unknown) => {
  console.error(error instanceof Error ? error.stack : error);
  process.exitCode = 1;
});
