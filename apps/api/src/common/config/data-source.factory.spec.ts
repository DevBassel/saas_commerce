import { ConfigService } from '@nestjs/config';
import { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions';
import {
  buildDataSourceOptions,
  DataSourceOverrides,
} from './data-source.factory';
import { IDB, IENV } from './env.interface';

jest.mock('../logger/typeorm-daily.logger', () => ({
  TypeOrmDailyLogger: jest
    .fn()
    .mockImplementation((options: string) => ({ options })),
}));

const db: IDB = {
  name: 'saas_store',
  host: '127.0.0.1',
  port: 5432,
  username: 'postgres',
  password: 'pg-secret',
  synchronize: true,
  syncTenants: false,
  logging: true,
  ssl: false,
  tenantPoolSize: 5,
  tenantStorageCapacityBytes: 1_000_000,
  tenantDbCapacityBytes: 2_000_000,
};

let getOrThrowMock: jest.Mock;

const makeConfig = (overrides: Partial<IDB> = {}): ConfigService<IENV> => {
  getOrThrowMock = jest.fn((key: string) => {
    if (key === 'db') return { ...db, ...overrides };
    throw new Error(`Unexpected config group: ${key}`);
  });
  return { getOrThrow: getOrThrowMock } as unknown as ConfigService<IENV>;
};

const build = (
  overrides: DataSourceOverrides = {},
  config: ConfigService<IENV> = makeConfig(),
): PostgresConnectionOptions => buildDataSourceOptions(config, overrides);

const entities = [
  class SampleEntity {},
] as unknown as PostgresConnectionOptions['entities'];

describe('buildDataSourceOptions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('maps the db config group into postgres connection options', () => {
    const config = makeConfig();

    const options = build({}, config);

    expect(getOrThrowMock).toHaveBeenCalledWith('db');
    expect(options).toMatchObject({
      type: 'postgres',
      host: '127.0.0.1',
      port: 5432,
      username: 'postgres',
      password: 'pg-secret',
      database: 'saas_store',
      ssl: false,
      logging: true,
      synchronize: true,
    });
  });

  it('exposes a shared TypeORM logger instance', () => {
    const first = build();
    const second = build();

    expect(first.logger).toBeDefined();
    expect(first.logger).toBe(second.logger);
  });

  it('includes no overrides when the overrides object is empty', () => {
    const options = build();

    expect(options).not.toHaveProperty('schema');
    expect(options).not.toHaveProperty('entities');
    expect(options).not.toHaveProperty('poolSize');
  });

  it('includes the schema only when truthy', () => {
    expect(build({ schema: 'tenant_acme' }).schema).toBe('tenant_acme');
    expect(build({ schema: '' })).not.toHaveProperty('schema');
  });

  it('includes entities only when provided', () => {
    expect(build({ entities }).entities).toBe(entities);
    expect(build({ entities: undefined })).not.toHaveProperty('entities');
  });

  it('includes the pool size only when truthy', () => {
    expect(build({ poolSize: 9 }).poolSize).toBe(9);
    expect(build({ poolSize: 0 })).not.toHaveProperty('poolSize');
  });

  it('always takes synchronize from db and ignores the override', () => {
    const enabled = build(
      { synchronize: false },
      makeConfig({ synchronize: true }),
    );
    const disabled = build(
      { synchronize: true },
      makeConfig({ synchronize: false }),
    );

    expect(enabled.synchronize).toBe(true);
    expect(disabled.synchronize).toBe(false);
  });

  it('passes the db ssl and logging flags through unchanged', () => {
    const options = build({}, makeConfig({ ssl: true, logging: false }));

    expect(options.ssl).toBe(true);
    expect(options.logging).toBe(false);
  });
});
