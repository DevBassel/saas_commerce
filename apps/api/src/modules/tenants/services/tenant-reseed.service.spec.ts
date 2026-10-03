import { DataSource } from 'typeorm';
import { TenantReseedService } from './tenant-reseed.service';
import { TenantService } from '../tenant.service';
import { TenantManagerService } from './tenant-manager.service';
import { Tenant } from '../entities/tenant.entity';
import { TenantStatus } from '../enums/tenantStatus.enum';
import { TENANT_ROLE_KEYS, seedRbac } from '../../rbac/utils/rbac.seed';

jest.mock('../../rbac/utils/rbac.seed', () => {
  const actual = jest.requireActual<
    typeof import('../../rbac/utils/rbac.seed')
  >('../../rbac/utils/rbac.seed');
  return { ...actual, seedRbac: jest.fn() };
});

const seedRbacMock = seedRbac as jest.MockedFunction<typeof seedRbac>;

const makeTenant = (
  slug: string,
  status: TenantStatus = TenantStatus.ACTIVE,
): Tenant => ({ slug, schemaName: `tenant_${slug}`, status }) as Tenant;

const buildMocks = (tenants: Tenant[]) => {
  const ds = { marker: 'ds' } as unknown as DataSource;
  const findAll = jest.fn().mockResolvedValue(tenants);
  const getDataSource = jest.fn().mockResolvedValue(ds);
  const tenantService = { findAll } as unknown as TenantService;
  const tenantManager = {
    getDataSource,
  } as unknown as TenantManagerService;

  const service = new TenantReseedService(tenantService, tenantManager);

  return { service, findAll, getDataSource, ds };
};

describe('TenantReseedService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('loads every tenant and re-seeds only the ACTIVE ones', async () => {
    const active = makeTenant('active');
    const inactive = makeTenant('inactive', TenantStatus.INACTIVE);
    const { service, findAll, getDataSource } = buildMocks([active, inactive]);

    await service.onApplicationBootstrap();

    expect(findAll).toHaveBeenCalledTimes(1);
    expect(getDataSource).toHaveBeenCalledTimes(1);
    expect(getDataSource).toHaveBeenCalledWith(active);
    expect(seedRbacMock).toHaveBeenCalledTimes(1);
  });

  it('passes the full tenant to the manager and seeds the tenant roles', async () => {
    const active = makeTenant('acme');
    const { service, ds } = buildMocks([active]);

    await service.onApplicationBootstrap();

    expect(seedRbacMock).toHaveBeenCalledWith(ds, {
      roles: TENANT_ROLE_KEYS,
    });
  });

  it('returns early without touching the manager when no tenant is active', async () => {
    const { service, getDataSource } = buildMocks([
      makeTenant('one', TenantStatus.INACTIVE),
      makeTenant('two', TenantStatus.INACTIVE),
    ]);

    await expect(service.onApplicationBootstrap()).resolves.toBeUndefined();
    expect(getDataSource).not.toHaveBeenCalled();
    expect(seedRbacMock).not.toHaveBeenCalled();
  });

  it('isolates a per-tenant failure so the remaining tenants still run', async () => {
    const first = makeTenant('first');
    const second = makeTenant('second');
    const third = makeTenant('third');
    const { service, getDataSource, ds } = buildMocks([first, second, third]);
    getDataSource.mockImplementation((tenant: Tenant) => {
      if (tenant.slug === 'second') return Promise.reject(new Error('boom'));
      return Promise.resolve(ds);
    });

    await expect(service.onApplicationBootstrap()).resolves.toBeUndefined();

    expect(getDataSource).toHaveBeenCalledTimes(3);
    expect(seedRbacMock).toHaveBeenCalledTimes(2);
    expect(seedRbacMock).toHaveBeenNthCalledWith(1, ds, {
      roles: TENANT_ROLE_KEYS,
    });
    expect(seedRbacMock).toHaveBeenNthCalledWith(2, ds, {
      roles: TENANT_ROLE_KEYS,
    });
  });

  it('continues past a seed failure on one tenant', async () => {
    const first = makeTenant('first');
    const second = makeTenant('second');
    const third = makeTenant('third');
    const { service, getDataSource } = buildMocks([first, second, third]);
    seedRbacMock
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('seed failed'))
      .mockResolvedValueOnce(undefined);

    await expect(service.onApplicationBootstrap()).resolves.toBeUndefined();

    expect(getDataSource).toHaveBeenCalledTimes(3);
    expect(seedRbacMock).toHaveBeenCalledTimes(3);
  });
});
