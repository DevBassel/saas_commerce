import { ConfigService } from '@nestjs/config';
import { IDB, IENV } from '../../common/config/env.interface';
import {
  PLATFORM_MIGRATIONS_TABLE,
  TENANT_MIGRATIONS_TABLE,
  assertTenantSchemaName,
  buildPlatformDataSourceOptions,
  buildTenantDataSourceOptions,
} from '../data-source-options';
import { PLATFORM_ENTITIES } from '../platform-entities';
import { TENANT_ENTITIES } from '../../modules/tenants/utils/tenant-entities';
import { scopeTenantMigrationSql } from '../tenant-migration.data-source';

const db: IDB = {
  name: 'saas_store',
  host: '127.0.0.1',
  port: 5432,
  username: 'postgres',
  password: 'secret',
  synchronize: true,
  syncTenants: true,
  logging: false,
  ssl: false,
  tenantPoolSize: 5,
  tenantStorageCapacityBytes: 1_000,
  tenantDbCapacityBytes: 1_000,
  statementTimeoutMs: 30_000,
};

const config = {
  getOrThrow: jest.fn((key: string) => (key === 'db' ? db : undefined)),
} as unknown as ConfigService<IENV>;

describe('migration datasource options', () => {
  it('builds the platform datasource with explicit entities and safety flags', () => {
    const options = buildPlatformDataSourceOptions(config);

    expect(options).toMatchObject({
      schema: 'public',
      entities: PLATFORM_ENTITIES,
      migrationsTableName: PLATFORM_MIGRATIONS_TABLE,
      migrationsRun: false,
      synchronize: false,
    });
  });

  it('builds an isolated tenant datasource without hardcoding a tenant', () => {
    const options = buildTenantDataSourceOptions(config, 'tenant_acme', 1);

    expect(options).toMatchObject({
      schema: 'tenant_acme',
      entities: TENANT_ENTITIES,
      poolSize: 1,
      migrationsTableName: TENANT_MIGRATIONS_TABLE,
      migrationsRun: false,
      synchronize: false,
    });
  });

  it.each(['public', 'tenant-Acme', 'other_acme', 'tenant_'])(
    'rejects unsafe tenant schema %s',
    (schemaName) => {
      expect(() => assertTenantSchemaName(schemaName)).toThrow(
        'Invalid tenant schema name',
      );
    },
  );

  it('rebinds generated and placeholder tenant SQL to the requested schema', () => {
    const sql =
      'CREATE TABLE "tenant_generation_source"."one" (); CREATE TABLE "__tenant_schema__"."two" (); SELECT * FROM "tenant_migrations"';

    expect(scopeTenantMigrationSql(sql, 'tenant_acme')).toBe(
      'CREATE TABLE "tenant_acme"."one" (); CREATE TABLE "tenant_acme"."two" (); SELECT * FROM "tenant_migrations"',
    );
  });
});
