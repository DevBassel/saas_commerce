import { DataSource } from 'typeorm';
import { TenantRolesSeeder } from './roles.seeder';
import { upsertRoles } from '../../helpers/rbac.seed';
import { Tenant } from 'src/modules/tenants/entities/tenant.entity';

jest.mock('../../helpers/rbac.seed', () => ({
  TENANT_ROLE_KEYS: ['STORE_OWNER', 'ADMIN', 'CUSTOMER'],
  upsertRoles: jest.fn().mockResolvedValue(undefined),
}));

const upsertRolesMock = upsertRoles as jest.MockedFunction<typeof upsertRoles>;

describe('TenantRolesSeeder', () => {
  beforeEach(() => jest.clearAllMocks());

  it('upserts each tenant role in its own transaction', async () => {
    const manager = { marker: 'manager' };
    const transaction = jest.fn((cb: (m: unknown) => unknown) => cb(manager));
    const dataSource = { transaction } as unknown as DataSource;
    const seeder = new TenantRolesSeeder();

    await seeder.run({
      dataSource,
      manager: dataSource.manager,
      environment: 'development',
      tenant: { slug: 'acme' } as Tenant,
      schemaName: 'tenant_acme',
    });

    expect(seeder.name).toBe('roles');
    expect(transaction).toHaveBeenCalledTimes(3);
    expect(upsertRolesMock).toHaveBeenCalledTimes(3);
    expect(upsertRolesMock).toHaveBeenNthCalledWith(1, manager, [
      'STORE_OWNER',
    ]);
    expect(upsertRolesMock).toHaveBeenNthCalledWith(2, manager, ['ADMIN']);
    expect(upsertRolesMock).toHaveBeenNthCalledWith(3, manager, ['CUSTOMER']);
  });
});
