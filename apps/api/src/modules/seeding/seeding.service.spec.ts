import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { SeedingService } from './seeding.service';
import { SeederRegistry } from './seeder-registry.service';
import { PlatformSeeder } from './interfaces/seeder.interface';
import { TenantSeeder } from './interfaces/tenant-seeder.interface';
import { TenantService } from 'src/modules/tenants/tenant.service';
import { TenantManagerService } from 'src/modules/tenants/services/tenant-manager.service';
import { Tenant } from 'src/modules/tenants/entities/tenant.entity';
import { TenantStatus } from 'src/modules/tenants/enums/tenantStatus.enum';
import { SeederScope } from './constants/seeding.constants';

interface SeederHandle<T> {
  seeder: T;
  run: jest.Mock;
}

const platformSeeder = (
  name: string,
  order = 10,
  environments?: string[],
): SeederHandle<PlatformSeeder> => {
  const run = jest.fn();
  return {
    seeder: { name, order, environments, run },
    run,
  };
};

const tenantSeeder = (
  name: string,
  order = 10,
  environments?: string[],
): SeederHandle<TenantSeeder> => {
  const run = jest.fn();
  return {
    seeder: { name, order, environments, run },
    run,
  };
};

const makeTenant = (
  slug: string,
  status: TenantStatus = TenantStatus.ACTIVE,
): Tenant => ({ id: 1, slug, schemaName: `tenant_${slug}`, status }) as Tenant;

const build = (options: { env?: string; allowProduction?: boolean } = {}) => {
  const registry = {
    getPlatform: jest.fn().mockReturnValue([]),
    getTenant: jest.fn().mockReturnValue([]),
  };
  const findAll = jest.fn().mockResolvedValue([]);
  const findById = jest.fn();
  const findBySlug = jest.fn();
  const getDataSource = jest.fn();
  const config = {
    getOrThrow: jest.fn((key: string) =>
      key === 'app'
        ? { env: options.env ?? 'development' }
        : { allowProduction: options.allowProduction ?? false },
    ),
  };
  const publicDataSource = {} as DataSource;

  const service = new SeedingService(
    registry as unknown as SeederRegistry,
    { findAll, findById, findBySlug } as unknown as TenantService,
    { getDataSource } as unknown as TenantManagerService,
    config as never,
    publicDataSource,
  );

  return {
    service,
    registry,
    findAll,
    findById,
    findBySlug,
    getDataSource,
  };
};

describe('SeedingService environment guard', () => {
  it('allows seeding in development without force', async () => {
    const { service } = build({ env: 'development' });

    await expect(service.runPlatform()).resolves.toEqual({
      ran: [],
      failures: [],
    });
  });

  it('blocks production without SEED_ALLOW_PRODUCTION and --force', async () => {
    const { service } = build({ env: 'production', allowProduction: false });

    await expect(service.runPlatform({ force: true })).rejects.toThrow(
      /Refusing to seed in production/,
    );
  });

  it('blocks production when allowProduction is true but --force is missing', async () => {
    const { service } = build({ env: 'production', allowProduction: true });

    await expect(service.runPlatform()).rejects.toThrow(
      /Refusing to seed in production/,
    );
  });

  it('allows production seeding with allowProduction and --force', async () => {
    const { service } = build({ env: 'production', allowProduction: true });

    await expect(service.runPlatform({ force: true })).resolves.toEqual({
      ran: [],
      failures: [],
    });
  });

  it('bypasses the guard for bootstrap runs', async () => {
    const { service } = build({ env: 'production', allowProduction: false });

    await expect(
      service.runPlatform({ bypassEnvironmentGuard: true }),
    ).resolves.toEqual({ ran: [], failures: [] });
  });
});

describe('SeedingService.runPlatform', () => {
  it('runs seeders in order and records each run', async () => {
    const { service, registry } = build();
    const first = platformSeeder('permissions', 10);
    const second = platformSeeder('roles', 20);
    registry.getPlatform.mockReturnValue([first.seeder, second.seeder]);

    const result = await service.runPlatform();

    expect(first.run).toHaveBeenCalledTimes(1);
    expect(second.run).toHaveBeenCalledTimes(1);
    expect(result.ran).toEqual([
      { scope: SeederScope.PLATFORM, seeder: 'permissions' },
      { scope: SeederScope.PLATFORM, seeder: 'roles' },
    ]);
  });

  it('stops remaining platform seeders on failure and records it', async () => {
    const { service, registry } = build();
    const first = platformSeeder('permissions', 10);
    const second = platformSeeder('roles', 20);
    const third = platformSeeder('plans', 40);
    first.run.mockResolvedValue(undefined);
    second.run.mockRejectedValue(new Error('boom'));
    registry.getPlatform.mockReturnValue([
      first.seeder,
      second.seeder,
      third.seeder,
    ]);

    const result = await service.runPlatform();

    expect(third.run).not.toHaveBeenCalled();
    expect(result.ran.map((entry) => entry.seeder)).toEqual(['permissions']);
    expect(result.failures).toHaveLength(1);
    expect(result.failures[0].seeder).toBe('roles');
  });

  it('skips seeders whose environments exclude the current one', async () => {
    const { service, registry } = build({ env: 'development' });
    const onlyProd = platformSeeder('prod-only', 10, ['production']);
    registry.getPlatform.mockReturnValue([onlyProd.seeder]);

    const result = await service.runPlatform();

    expect(onlyProd.run).not.toHaveBeenCalled();
    expect(result.ran).toEqual([]);
  });
});

describe('SeedingService.runTenants', () => {
  it('seeds every ACTIVE tenant with its own datasource', async () => {
    const { service, registry, findAll, getDataSource } = build();
    const active = makeTenant('active');
    const inactive = makeTenant('inactive', TenantStatus.INACTIVE);
    findAll.mockResolvedValue([active, inactive]);
    const ds = { manager: { marker: 'tenant-ds' } } as unknown as DataSource;
    getDataSource.mockResolvedValue(ds);
    const permissions = tenantSeeder('permissions', 10);
    registry.getTenant.mockReturnValue([permissions.seeder]);

    const result = await service.runTenants({ allActive: true });

    expect(getDataSource).toHaveBeenCalledTimes(1);
    expect(getDataSource).toHaveBeenCalledWith(active);
    expect(permissions.run).toHaveBeenCalledWith(
      expect.objectContaining({
        dataSource: ds,
        tenant: active,
        schemaName: 'tenant_active',
      }),
    );
    expect(result.ran).toEqual([
      {
        scope: SeederScope.TENANT,
        seeder: 'permissions',
        tenant: { slug: 'active', schemaName: 'tenant_active' },
      },
    ]);
  });

  it('breaks remaining seeders for a tenant on failure but continues others', async () => {
    const { service, registry, findAll, getDataSource } = build();
    const first = makeTenant('first');
    const second = makeTenant('second');
    findAll.mockResolvedValue([first, second]);
    getDataSource.mockResolvedValue({
      manager: {},
    });
    const permissions = tenantSeeder('permissions', 10);
    const roles = tenantSeeder('roles', 20);
    roles.run.mockRejectedValue(new Error('boom'));
    registry.getTenant.mockReturnValue([permissions.seeder, roles.seeder]);

    const result = await service.runTenants({ allActive: true });

    expect(permissions.run).toHaveBeenCalledTimes(2);
    expect(roles.run).toHaveBeenCalledTimes(2);
    expect(result.failures).toHaveLength(2);
    expect(result.failures.every((f) => f.seeder === 'roles')).toBe(true);
    expect(result.failures.map((f) => f.tenant?.slug)).toEqual([
      'first',
      'second',
    ]);
  });

  it('records a datasource failure and continues with the next tenant', async () => {
    const { service, registry, findAll, getDataSource } = build();
    const first = makeTenant('first');
    const second = makeTenant('second');
    findAll.mockResolvedValue([first, second]);
    getDataSource
      .mockRejectedValueOnce(new Error('no connection'))
      .mockResolvedValueOnce({ manager: {} });
    const permissions = tenantSeeder('permissions', 10);
    registry.getTenant.mockReturnValue([permissions.seeder]);

    const result = await service.runTenants({ allActive: true });

    expect(result.failures).toHaveLength(1);
    expect(result.failures[0].seeder).toBe('<datasource>');
    expect(permissions.run).toHaveBeenCalledTimes(1);
  });

  it('resolves an explicit tenant by slug', async () => {
    const { service, findBySlug, getDataSource } = build();
    const tenant = makeTenant('demo');
    findBySlug.mockResolvedValue(tenant);
    getDataSource.mockResolvedValue({
      manager: {},
    });

    await service.runTenants({ slugs: ['demo'] });

    expect(findBySlug).toHaveBeenCalledWith('demo');
    expect(getDataSource).toHaveBeenCalledWith(tenant);
  });

  it('throws for an unknown tenant slug', async () => {
    const { service, findBySlug } = build();
    findBySlug.mockResolvedValue(null);

    await expect(service.runTenants({ slugs: ['nope'] })).rejects.toThrow(
      NotFoundException,
    );
  });

  it('aborts on an inactive explicit tenant unless forced', async () => {
    const { service, findById, getDataSource } = build();
    const inactive = makeTenant('paused', TenantStatus.INACTIVE);
    findById.mockResolvedValue(inactive);
    getDataSource.mockResolvedValue({
      manager: {},
    });

    await expect(service.runTenants({ tenantIds: [1] })).rejects.toThrow(
      BadRequestException,
    );

    await expect(
      service.runTenants({ tenantIds: [1], force: true }),
    ).resolves.toBeDefined();
  });
});

describe('SeedingService.runAll', () => {
  it('merges platform and tenant results', async () => {
    const { service, registry } = build();
    const permissions = platformSeeder('permissions', 10);
    registry.getPlatform.mockReturnValue([permissions.seeder]);
    registry.getTenant.mockReturnValue([]);

    const result = await service.runAll();

    expect(result.ran).toEqual([
      { scope: SeederScope.PLATFORM, seeder: 'permissions' },
    ]);
    expect(result.failures).toEqual([]);
  });
});
