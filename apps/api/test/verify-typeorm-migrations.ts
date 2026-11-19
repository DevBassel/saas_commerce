import 'reflect-metadata';
import assert from 'node:assert/strict';
import { DataSource } from 'typeorm';
import { buildDataSourceOptions } from '../src/database/data-source.factory';
import { createDatabaseConfig } from '../src/database/database-config';
import {
  buildPlatformDataSourceOptions,
  buildTenantDataSourceOptions,
} from '../src/database/data-source-options';
import { TenantManagerService } from '../src/modules/tenants/services/tenant-manager.service';
import { TenantMigrationService } from '../src/modules/tenants/services/tenant-migration.service';

const PLATFORM_SCHEMA = 'migration_verify_platform';
const TENANT_SCHEMAS = [
  'tenant_migration_verify_a',
  'tenant_migration_verify_b',
] as const;
const ALL_SCHEMAS = [PLATFORM_SCHEMA, ...TENANT_SCHEMAS];

const expectedPlatformTables = [
  'currency_change_requests',
  'permissions',
  'platform_migrations',
  'role_permissions',
  'roles',
  'stripe_webhook_events',
  'subscription_payments',
  'subscription_plan_features',
  'subscription_plan_limits',
  'subscription_plans',
  'subscriptions',
  'tenant_usage_counters',
  'tenants',
  'user',
  'user_permissions',
].sort();

const expectedTenantTables = [
  'addresses',
  'cart_items',
  'carts',
  'categories',
  'coupon_redemptions',
  'coupons',
  'order_items',
  'orders',
  'otp_challenges',
  'payments',
  'permissions',
  'product_images',
  'products',
  'role_permissions',
  'roles',
  'tenant_migrations',
  'user',
  'user_permissions',
].sort();

const tablesIn = async (
  dataSource: DataSource,
  schemaName: string,
): Promise<string[]> => {
  const rows = await dataSource.query<Array<{ table_name: string }>>(
    'SELECT table_name FROM information_schema.tables WHERE table_schema = $1 ORDER BY table_name',
    [schemaName],
  );
  return rows.map((row) => row.table_name);
};

const assertNoSchemaDrift = async (dataSource: DataSource): Promise<void> => {
  const schemaLog = await dataSource.driver.createSchemaBuilder().log();
  assert.equal(schemaLog.upQueries.length, 0);
};

const run = async (): Promise<void> => {
  const config = createDatabaseConfig();
  const control = new DataSource(buildDataSourceOptions(config));
  let platform: DataSource | undefined;
  const manager = new TenantManagerService(config);

  await control.initialize();
  try {
    const existing = await control.query<Array<{ schema_name: string }>>(
      'SELECT schema_name FROM information_schema.schemata WHERE schema_name = ANY($1)',
      [ALL_SCHEMAS],
    );
    assert.equal(
      existing.length,
      0,
      `Verification schemas already exist: ${existing.map((row) => row.schema_name).join(', ')}`,
    );

    await control.query(`CREATE SCHEMA "${PLATFORM_SCHEMA}"`);
    platform = new DataSource(
      buildPlatformDataSourceOptions(config, PLATFORM_SCHEMA),
    );
    await platform.initialize();

    const firstPlatformRun = await platform.runMigrations({
      transaction: 'each',
    });
    assert.deepEqual(
      firstPlatformRun.map((migration) => migration.name),
      ['InitialPlatform1795099462973'],
    );
    assert.deepEqual(
      await tablesIn(platform, PLATFORM_SCHEMA),
      expectedPlatformTables,
    );
    await assertNoSchemaDrift(platform);

    const tenantMigrations = new TenantMigrationService(manager, platform);
    for (const schemaName of TENANT_SCHEMAS) {
      const firstRun = await tenantMigrations.migrate(schemaName);
      assert.deepEqual(firstRun.executedMigrations, [
        'InitialTenant1795099463316',
      ]);
      assert.deepEqual(
        await tablesIn(platform, schemaName),
        expectedTenantTables,
      );

      const tenantDataSource = new DataSource(
        buildTenantDataSourceOptions(config, schemaName, 1),
      );
      await tenantDataSource.initialize();
      try {
        await assertNoSchemaDrift(tenantDataSource);
      } finally {
        await tenantDataSource.destroy();
      }
    }

    await platform.query(
      `INSERT INTO "${TENANT_SCHEMAS[0]}"."permissions" ("key", "name") VALUES ($1, $2)`,
      ['migration:isolation', 'Migration isolation'],
    );
    const isolatedCount = await platform.query<Array<{ count: string }>>(
      `SELECT COUNT(*)::text AS count FROM "${TENANT_SCHEMAS[1]}"."permissions"`,
    );
    assert.equal(isolatedCount[0].count, '0');

    assert.equal(
      (await platform.runMigrations({ transaction: 'each' })).length,
      0,
    );
    for (const schemaName of TENANT_SCHEMAS) {
      assert.equal(
        (await tenantMigrations.migrate(schemaName)).executedMigrations.length,
        0,
      );
    }

    console.log(
      'Verified platform baseline, two isolated tenant baselines, schema parity, and idempotent reruns',
    );
  } finally {
    await manager.onModuleDestroy();
    if (platform?.isInitialized) await platform.destroy();
    for (const schemaName of ALL_SCHEMAS) {
      await control.query(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
    }
    await control.destroy();
  }
};

run().catch((error: unknown) => {
  console.error(error instanceof Error ? error.stack : error);
  process.exitCode = 1;
});
