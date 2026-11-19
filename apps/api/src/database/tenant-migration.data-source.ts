import { DataSource, QueryRunner, ReplicationMode } from 'typeorm';
import { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions';
import { assertTenantSchemaName } from './data-source-options';

const TENANT_SCHEMA_IDENTIFIER = /"tenant_[a-z0-9_]+"(?=\.)/g;
const TENANT_SCHEMA_PLACEHOLDER = '"__tenant_schema__"';

export const scopeTenantMigrationSql = (
  sql: string,
  schemaName: string,
): string => {
  const schema = assertTenantSchemaName(schemaName);
  const target = `"${schema}"`;
  return sql
    .replaceAll(TENANT_SCHEMA_PLACEHOLDER, target)
    .replace(TENANT_SCHEMA_IDENTIFIER, target);
};

export class TenantMigrationDataSource extends DataSource {
  constructor(options: PostgresConnectionOptions) {
    super(options);
  }

  override createQueryRunner(mode?: ReplicationMode): QueryRunner {
    const queryRunner = super.createQueryRunner(mode);
    const schemaName = (this.options as PostgresConnectionOptions).schema;
    if (!schemaName) throw new Error('Tenant migration schema is required');
    // TypeORM's overloaded query method must retain its QueryRunner receiver.
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const query = queryRunner.query;

    return new Proxy(queryRunner, {
      get(target, property, receiver) {
        if (property === 'query') {
          return (sql: string, ...args: unknown[]): Promise<unknown> =>
            Reflect.apply(query, queryRunner, [
              scopeTenantMigrationSql(sql, schemaName),
              ...args,
            ]) as Promise<unknown>;
        }

        const value: unknown = Reflect.get(target, property, receiver);
        return typeof value === 'function'
          ? (...args: unknown[]): unknown =>
              Reflect.apply(value, target, args) as unknown
          : value;
      },
    });
  }
}
