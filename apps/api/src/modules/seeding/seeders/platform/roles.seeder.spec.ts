import { DataSource } from 'typeorm';
import { RoleKey } from 'src/common/constants/RoleKey.enum';
import { PlatformRolesSeeder } from './roles.seeder';
import { upsertRoles } from '../../helpers/rbac.seed';

jest.mock('../../helpers/rbac.seed', () => ({
  upsertRoles: jest.fn().mockResolvedValue(undefined),
}));

const upsertRolesMock = upsertRoles as jest.MockedFunction<typeof upsertRoles>;

describe('PlatformRolesSeeder', () => {
  beforeEach(() => jest.clearAllMocks());

  it('upserts the SUPER_ADMIN role inside a transaction', async () => {
    const manager = { marker: 'manager' };
    const transaction = jest.fn((cb: (m: unknown) => unknown) => cb(manager));
    const dataSource = { transaction } as unknown as DataSource;
    const seeder = new PlatformRolesSeeder();

    await seeder.run({ dataSource, environment: 'development' });

    expect(seeder.name).toBe('roles');
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(upsertRolesMock).toHaveBeenCalledWith(manager, [
      RoleKey.SUPER_ADMIN,
    ]);
  });
});
