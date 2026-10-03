import { DataSource } from 'typeorm';
import { TenantPermissionsSeeder } from './permissions.seeder';
import { upsertPermissions } from '../../helpers/rbac.seed';
import { Tenant } from 'src/modules/tenants/entities/tenant.entity';

jest.mock('../../helpers/rbac.seed', () => ({
  upsertPermissions: jest.fn().mockResolvedValue(undefined),
}));

const upsertPermissionsMock = upsertPermissions as jest.MockedFunction<
  typeof upsertPermissions
>;

describe('TenantPermissionsSeeder', () => {
  beforeEach(() => jest.clearAllMocks());

  it('upserts permissions on the tenant datasource only', async () => {
    const dataSource = { name: 'tenant-ds' } as unknown as DataSource;
    const publicDataSource = { name: 'public' } as unknown as DataSource;
    const seeder = new TenantPermissionsSeeder();

    await seeder.run({
      dataSource,
      manager: dataSource.manager,
      environment: 'development',
      tenant: { slug: 'acme' } as Tenant,
      schemaName: 'tenant_acme',
    });

    expect(seeder.name).toBe('permissions');
    expect(upsertPermissionsMock).toHaveBeenCalledWith(dataSource);
    expect(upsertPermissionsMock).not.toHaveBeenCalledWith(publicDataSource);
  });
});
