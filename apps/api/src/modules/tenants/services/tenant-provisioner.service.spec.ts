import { DataSource } from 'typeorm';
import { TenantProvisionerService } from './tenant-provisioner.service';
import { TenantManagerService } from './tenant-manager.service';
import { Tenant } from '../entities/tenant.entity';
import { TENANT_ROLE_KEYS, seedRbac } from '../../seeding/helpers/rbac.seed';

jest.mock('../../seeding/helpers/rbac.seed', () => {
  const actual = jest.requireActual<
    typeof import('../../seeding/helpers/rbac.seed')
  >('../../seeding/helpers/rbac.seed');
  return { ...actual, seedRbac: jest.fn() };
});

const seedRbacMock = seedRbac as jest.MockedFunction<typeof seedRbac>;

const tenant = {
  id: 1,
  slug: 'acme',
  schemaName: 'tenant_acme',
} as Tenant;

const buildMocks = () => {
  const ds = { marker: 'tenant-ds' } as unknown as DataSource;
  const query = jest.fn().mockResolvedValue(undefined);
  const publicDataSource = { query } as unknown as DataSource;
  const getDataSource = jest.fn().mockResolvedValue(ds);
  const manager = { getDataSource } as unknown as TenantManagerService;

  const service = new TenantProvisionerService(manager, publicDataSource);

  return { service, manager, publicDataSource, query, getDataSource, ds };
};

describe('TenantProvisionerService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates the schema with IF NOT EXISTS using the sanitized name', async () => {
    const { service, query } = buildMocks();

    await service.provision(tenant);

    expect(query).toHaveBeenCalledWith(
      'CREATE SCHEMA IF NOT EXISTS "tenant_acme"',
    );
  });

  it('sanitizes the schema name before issuing the SQL', async () => {
    const { service, query, getDataSource } = buildMocks();

    await service.provision({
      slug: 'acme',
      schemaName: 'Tenant-Acme!',
    } as Tenant);

    expect(query).toHaveBeenCalledWith(
      'CREATE SCHEMA IF NOT EXISTS "tenant_acme_"',
    );
    expect(getDataSource).toHaveBeenCalledWith({
      schemaName: 'tenant_acme_',
    });
  });

  it('initializes the tenant datasource for the schema', async () => {
    const { service, getDataSource, ds } = buildMocks();

    await service.provision(tenant);

    expect(getDataSource).toHaveBeenCalledTimes(1);
    expect(getDataSource).toHaveBeenCalledWith({ schemaName: 'tenant_acme' });
    expect(ds).toBeDefined();
  });

  it('seeds the tenant RBAC roles on the new datasource', async () => {
    const { service, ds } = buildMocks();

    await service.provision(tenant);

    expect(seedRbacMock).toHaveBeenCalledTimes(1);
    expect(seedRbacMock).toHaveBeenCalledWith(ds, {
      roles: TENANT_ROLE_KEYS,
    });
  });

  it('returns the tenant datasource', async () => {
    const { service, ds } = buildMocks();

    await expect(service.provision(tenant)).resolves.toBe(ds);
  });

  it('is idempotent for an already-provisioned tenant', async () => {
    const { service, query, getDataSource } = buildMocks();

    await service.provision(tenant);
    await expect(service.provision(tenant)).resolves.toBeDefined();

    expect(query).toHaveBeenCalledTimes(2);
    expect(getDataSource).toHaveBeenCalledTimes(2);
    expect(seedRbacMock).toHaveBeenCalledTimes(2);
  });
});
