import { DataSource } from 'typeorm';
import { PlatformPermissionsSeeder } from './permissions.seeder';
import { upsertPermissions } from '../../helpers/rbac.seed';

jest.mock('../../helpers/rbac.seed', () => ({
  upsertPermissions: jest.fn().mockResolvedValue(undefined),
}));

const upsertPermissionsMock = upsertPermissions as jest.MockedFunction<
  typeof upsertPermissions
>;

describe('PlatformPermissionsSeeder', () => {
  beforeEach(() => jest.clearAllMocks());

  it('upserts the seeded permissions on the public datasource', async () => {
    const dataSource = { name: 'public' } as unknown as DataSource;
    const seeder = new PlatformPermissionsSeeder();

    await seeder.run({ dataSource, environment: 'development' });

    expect(seeder.name).toBe('permissions');
    expect(upsertPermissionsMock).toHaveBeenCalledWith(dataSource);
  });
});
