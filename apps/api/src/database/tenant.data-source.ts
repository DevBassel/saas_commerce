import 'reflect-metadata';
import { createDatabaseConfig } from './database-config';
import { buildTenantDataSourceOptions } from './data-source-options';
import { TenantMigrationDataSource } from './tenant-migration.data-source';

const schemaName = process.env.TYPEORM_TENANT_SCHEMA;
if (!schemaName) {
  throw new Error(
    'TYPEORM_TENANT_SCHEMA is required for tenant migration CLI commands',
  );
}

const tenantDataSource = new TenantMigrationDataSource(
  buildTenantDataSourceOptions(createDatabaseConfig(), schemaName, 1),
);

export default tenantDataSource;
