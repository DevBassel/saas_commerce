import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { buildDataSourceOptions } from 'src/common/config/data-source.factory';
import { IENV } from 'src/common/config/env.interface';
import { TENANT_ENTITIES } from '../tenant-entities';
import { TenantManagerService } from './tenant-manager.service';

jest.mock('src/common/config/data-source.factory', () => ({
  buildDataSourceOptions: jest.fn(() => ({ type: 'postgres' })),
}));

jest.mock('typeorm', () => {
  const actual = jest.requireActual<typeof import('typeorm')>('typeorm');
  return {
    ...actual,
    DataSource: jest.fn(),
  };
});

const DataSourceMock = DataSource as unknown as jest.Mock;
const buildOptionsMock = buildDataSourceOptions as jest.Mock;

interface FakeDataSource {
  options: unknown;
  isInitialized: boolean;
  initialize: jest.Mock;
  destroy: jest.Mock;
  getRepository: jest.Mock;
}

const fakeRepo = { marker: 'repo' };
let instances: FakeDataSource[] = [];

const installDataSourceMock = (initialize?: () => Promise<unknown>) => {
  instances = [];
  DataSourceMock.mockImplementation((options: unknown) => {
    const ds: FakeDataSource = {
      options,
      isInitialized: false,
      initialize: jest.fn(async () => {
        if (initialize) await initialize();
        ds.isInitialized = true;
        return ds;
      }),
      destroy: jest.fn(() => {
        ds.isInitialized = false;
        return Promise.resolve();
      }),
      getRepository: jest.fn(() => fakeRepo),
    };
    instances.push(ds);
    return ds;
  });
};

const makeConfig = (
  overrides: {
    env?: string;
    synchronize?: boolean;
    syncTenants?: boolean;
    poolSize?: number;
  } = {},
): ConfigService<IENV> => {
  const db = {
    tenantPoolSize: overrides.poolSize ?? 7,
    synchronize: overrides.synchronize ?? false,
    syncTenants: overrides.syncTenants ?? false,
  };
  const app = { env: overrides.env ?? 'development' };
  return {
    getOrThrow: jest.fn((key: string) =>
      key === 'db' ? db : key === 'app' ? app : undefined,
    ),
  } as unknown as ConfigService<IENV>;
};

describe('TenantManagerService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    installDataSourceMock();
  });

  it('creates and initializes a datasource on a cache miss and reuses it afterwards', async () => {
    const service = new TenantManagerService(makeConfig());

    const first = await service.getDataSource({ schemaName: 'tenant_a' });
    const second = await service.getDataSource({ schemaName: 'tenant_a' });

    expect(first).toBe(second);
    expect(instances).toHaveLength(1);
    expect(instances[0].initialize).toHaveBeenCalledTimes(1);
  });

  it('shares a single in-flight promise for concurrent requests', async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    installDataSourceMock(() => gate);
    const service = new TenantManagerService(makeConfig());

    const p1 = service.getDataSource({ schemaName: 'tenant_a' });
    const p2 = service.getDataSource({ schemaName: 'tenant_a' });

    expect(instances).toHaveLength(1);
    release();
    const [ds1, ds2] = await Promise.all([p1, p2]);

    expect(ds1).toBe(ds2);
    expect(instances[0].initialize).toHaveBeenCalledTimes(1);
  });

  it('creates a separate datasource per schema', async () => {
    const service = new TenantManagerService(makeConfig());

    await service.getDataSource({ schemaName: 'tenant_a' });
    await service.getDataSource({ schemaName: 'tenant_b' });

    expect(instances).toHaveLength(2);
    expect(DataSourceMock).toHaveBeenCalledTimes(2);
  });

  it('evicts the oldest datasource once the cache reaches the cap', async () => {
    const service = new TenantManagerService(makeConfig());

    for (let i = 0; i <= 100; i += 1) {
      await service.getDataSource({ schemaName: `tenant_${i}` });
    }

    expect(instances).toHaveLength(101);
    expect(instances[0].destroy).toHaveBeenCalledTimes(1);
    expect(instances[1].destroy).not.toHaveBeenCalled();
  });

  it('treats a cache hit as recent use so it survives the next eviction', async () => {
    const service = new TenantManagerService(makeConfig());

    for (let i = 0; i <= 99; i += 1) {
      await service.getDataSource({ schemaName: `tenant_${i}` });
    }
    await service.getDataSource({ schemaName: 'tenant_0' });

    await service.getDataSource({ schemaName: 'tenant_100' });

    expect(instances[0].destroy).not.toHaveBeenCalled();
    expect(instances[1].destroy).toHaveBeenCalledTimes(1);
  });

  describe('getRepository', () => {
    it('resolves the repository from the cached datasource', async () => {
      const service = new TenantManagerService(makeConfig());

      const repo = await service.getRepository(class Entity {}, {
        schemaName: 'tenant_a',
      });

      expect(repo).toBe(fakeRepo);
      expect(instances[0].getRepository).toHaveBeenCalledWith(
        expect.any(Function),
      );
    });
  });

  describe('release', () => {
    it('destroys and removes a cached datasource', async () => {
      const service = new TenantManagerService(makeConfig());
      const ds = await service.getDataSource({ schemaName: 'tenant_a' });

      await service.release({ schemaName: 'tenant_a' });

      expect(ds.isInitialized).toBe(false);
      expect(instances[0].destroy).toHaveBeenCalledTimes(1);
    });

    it('is a no-op for an unknown schema', async () => {
      const service = new TenantManagerService(makeConfig());

      await expect(
        service.release({ schemaName: 'tenant_missing' }),
      ).resolves.toBeUndefined();
      expect(instances).toHaveLength(0);
    });

    it('does not destroy an uninitialized datasource', async () => {
      const service = new TenantManagerService(makeConfig());
      await service.getDataSource({ schemaName: 'tenant_a' });
      instances[0].isInitialized = false;

      await service.release({ schemaName: 'tenant_a' });

      expect(instances[0].destroy).not.toHaveBeenCalled();
    });
  });

  it('destroys every cached datasource on module destroy', async () => {
    const service = new TenantManagerService(makeConfig());
    await service.getDataSource({ schemaName: 'tenant_a' });
    await service.getDataSource({ schemaName: 'tenant_b' });

    await service.onModuleDestroy();

    expect(instances[0].destroy).toHaveBeenCalledTimes(1);
    expect(instances[1].destroy).toHaveBeenCalledTimes(1);
  });

  describe('datasource options', () => {
    const buildWith = async (
      overrides: Parameters<typeof makeConfig>[0],
    ): Promise<Record<string, unknown>> => {
      buildOptionsMock.mockClear();
      const service = new TenantManagerService(makeConfig(overrides));
      await service.getDataSource({ schemaName: 'tenant_a' });
      const calls = buildOptionsMock.mock.calls as unknown as Array<
        [unknown, Record<string, unknown>]
      >;
      return calls[0][1];
    };

    it('passes the schema, entities and pool size through', async () => {
      const overrides = await buildWith({ synchronize: true, poolSize: 11 });

      expect(overrides.schema).toBe('tenant_a');
      expect(overrides.entities).toBe(TENANT_ENTITIES);
      expect(overrides.poolSize).toBe(11);
    });

    it.each([
      ['development', true, false, true],
      ['development', false, false, false],
      ['production', true, false, false],
      ['production', true, true, true],
      ['production', false, true, false],
    ])(
      'synchronize for env=%s synchronize=%s syncTenants=%s is %s',
      async (env, synchronize, syncTenants, expected) => {
        const overrides = await buildWith({ env, synchronize, syncTenants });
        expect(overrides.synchronize).toBe(expected);
      },
    );
  });
});
