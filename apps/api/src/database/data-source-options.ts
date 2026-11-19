import { ConfigService } from '@nestjs/config';
import { join } from 'node:path';
import { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions';
import { buildDataSourceOptions } from './data-source.factory';
import { IDB, IENV } from '../common/config/env.interface';
import { TENANT_ENTITIES } from '../modules/tenants/utils/tenant-entities';
import { sanitizeSchemaName } from '../modules/tenants/utils/tenant.utils';
import { PLATFORM_ENTITIES } from './platform-entities';

export const PLATFORM_MIGRATIONS_TABLE = 'platform_migrations';
export const TENANT_MIGRATIONS_TABLE = 'tenant_migrations';

export const assertTenantSchemaName = (schemaName: string): string => {
  const sanitized = sanitizeSchemaName(schemaName);
  if (sanitized !== schemaName || !/^tenant_[a-z0-9_]+$/.test(sanitized)) {
    throw new Error(`Invalid tenant schema name: ${schemaName}`);
  }
  return sanitized;
};

export const buildPlatformDataSourceOptions = (
  config: ConfigService<IENV>,
  schemaName = 'public',
): PostgresConnectionOptions => ({
  ...buildDataSourceOptions(config, {
    schema: schemaName,
    entities: PLATFORM_ENTITIES,
  }),
  migrations: [join(__dirname, 'migrations/platform/*{.ts,.js}')],
  migrationsTableName: PLATFORM_MIGRATIONS_TABLE,
  migrationsTransactionMode: 'each',
  migrationsRun: false,
  synchronize: false,
});

export const buildTenantDataSourceOptions = (
  config: ConfigService<IENV>,
  schemaName: string,
  poolSize?: number,
): PostgresConnectionOptions => {
  const schema = assertTenantSchemaName(schemaName);
  const configuredPoolSize = config.getOrThrow<IDB>('db').tenantPoolSize;

  return {
    ...buildDataSourceOptions(config, {
      schema,
      entities: TENANT_ENTITIES,
      poolSize: poolSize ?? configuredPoolSize,
    }),
    migrations: [join(__dirname, 'migrations/tenant/*{.ts,.js}')],
    migrationsTableName: TENANT_MIGRATIONS_TABLE,
    migrationsTransactionMode: 'each',
    migrationsRun: false,
    synchronize: false,
  };
};
