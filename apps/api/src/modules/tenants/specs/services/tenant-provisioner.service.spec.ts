import { DataSource } from 'typeorm';
import { TenantProvisionerService } from '../../services/tenant-provisioner.service';
import { TenantManagerService } from '../../services/tenant-manager.service';
import { Tenant } from '../../entities/tenant.entity';
import { TENANT_ROLE_KEYS, seedRbac } from '../../../seeding/helpers/rbac.seed';
import { TenantMigrationService } from '../../services/tenant-migration.service';

jest.mock('../../../seeding/helpers/rbac.seed', () => {
  const actual = jest.requireActual<
    typeof import('../../../seeding/helpers/rbac.seed')
  >('../../../seeding/helpers/rbac.seed');
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
  const getDataSource = jest.fn().mockResolvedValue(ds);
  const manager = { getDataSource } as unknown as TenantManagerService;
  const migrate = jest.fn().mockResolvedValue({
    schemaName: tenant.schemaName,
    executedMigrations: [],
  });
  const migrations = { migrate } as unknown as TenantMigrationService;

  const service = new TenantProvisionerService(manager, migrations);

  return { service, manager, migrations, migrate, getDataSource, ds };
};

describe('TenantProvisionerService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('runs tenant migrations before opening the runtime datasource', async () => {
    const { service, migrate, getDataSource } = buildMocks();

    await service.provision(tenant);

    expect(migrate).toHaveBeenCalledWith('tenant_acme');
    expect(migrate.mock.invocationCallOrder[0]).toBeLessThan(
      getDataSource.mock.invocationCallOrder[0],
    );
  });

  it('sanitizes the schema name before issuing the SQL', async () => {
    const { service, migrate, getDataSource } = buildMocks();

    await service.provision({
      slug: 'acme',
      schemaName: 'Tenant-Acme!',
    } as Tenant);

    expect(migrate).toHaveBeenCalledWith('tenant_acme_');
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
    const { service, migrate, getDataSource } = buildMocks();

    await service.provision(tenant);
    await expect(service.provision(tenant)).resolves.toBeDefined();

    expect(migrate).toHaveBeenCalledTimes(2);
    expect(getDataSource).toHaveBeenCalledTimes(2);
    expect(seedRbacMock).toHaveBeenCalledTimes(2);
  });
});
