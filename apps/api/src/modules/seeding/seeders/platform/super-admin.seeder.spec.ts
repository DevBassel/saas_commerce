import { DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { IENV } from 'src/common/config/env.interface';
import { SuperAdminSeeder } from './super-admin.seeder';
import { ensureBootstrapSuperAdmin } from '../../helpers/rbac.seed';

jest.mock('../../helpers/rbac.seed', () => ({
  ensureBootstrapSuperAdmin: jest.fn().mockResolvedValue(undefined),
}));

const ensureMock = ensureBootstrapSuperAdmin as jest.MockedFunction<
  typeof ensureBootstrapSuperAdmin
>;

const buildConfig = (rounds = 12) =>
  ({
    getOrThrow: jest.fn((key: string) =>
      key === 'app'
        ? {
            bootstrapSuperAdminEmail: 'root@test.dev',
            bootstrapSuperAdminPassword: 'password',
            bootstrapSuperAdminName: 'Root',
          }
        : { rounds },
    ),
  }) as unknown as ConfigService<IENV>;

describe('SuperAdminSeeder', () => {
  beforeEach(() => jest.clearAllMocks());

  it('delegates to the bootstrap super admin helper', async () => {
    const dataSource = { name: 'public' } as unknown as DataSource;
    const seeder = new SuperAdminSeeder(buildConfig());

    await seeder.run({ dataSource, environment: 'development' });

    expect(seeder.name).toBe('super-admin');
    expect(ensureMock).toHaveBeenCalledWith(dataSource, {
      email: 'root@test.dev',
      password: 'password',
      name: 'Root',
      rounds: 12,
    });
  });

  it('defaults the bcrypt rounds to 12', async () => {
    const dataSource = {} as DataSource;
    const seeder = new SuperAdminSeeder(buildConfig(0));

    await seeder.run({ dataSource, environment: 'development' });

    expect(ensureMock).toHaveBeenCalledWith(
      dataSource,
      expect.objectContaining({ rounds: 12 }),
    );
  });
});
