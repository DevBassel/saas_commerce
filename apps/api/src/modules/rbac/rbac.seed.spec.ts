import { Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { RoleKey } from 'src/common/constants/RoleKey.enum';
import { Permission } from './entities/permission.entity';
import { Role } from './entities/role.entity';
import { SEED_PERMISSIONS, SEED_ROLE_PERMISSIONS } from './constants/seed-data';
import { seedRbac } from './rbac.seed';

const permissionEntities = SEED_PERMISSIONS.map((p, index) => ({
  id: index + 1,
  key: p.key,
  name: p.name,
  description: p.description,
}));

const buildMocks = () => {
  const permissionRepo = {
    findOneBy: jest.fn().mockResolvedValue(null),
    create: jest.fn((data: unknown) => data),
    save: jest.fn((data: unknown) => data),
    find: jest.fn().mockResolvedValue(permissionEntities),
  };
  const roleRepo = {
    findOneBy: jest.fn().mockResolvedValue(null),
    create: jest.fn((data: unknown) => data),
    save: jest.fn((data: unknown) => data),
  };
  const dataSource = {
    getRepository: jest.fn((entity: unknown) =>
      entity === Permission ? permissionRepo : roleRepo,
    ),
  };

  return { dataSource, permissionRepo, roleRepo };
};

describe('seedRbac', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => jest.restoreAllMocks());

  it('creates every missing permission', async () => {
    const { dataSource, permissionRepo } = buildMocks();

    await seedRbac(dataSource as unknown as DataSource, { roles: [] });

    expect(dataSource.getRepository).toHaveBeenCalledWith(Permission);
    expect(permissionRepo.save).toHaveBeenCalledTimes(SEED_PERMISSIONS.length);
    expect(permissionRepo.findOneBy).toHaveBeenCalledWith({
      key: SEED_PERMISSIONS[0].key,
    });
  });

  it('does not recreate permissions that already exist', async () => {
    const { dataSource, permissionRepo } = buildMocks();
    permissionRepo.findOneBy.mockImplementation(
      ({ key }: { key: string }) =>
        permissionEntities.find((p) => String(p.key) === key) ?? null,
    );

    await seedRbac(dataSource as unknown as DataSource, { roles: [] });

    expect(permissionRepo.save).not.toHaveBeenCalled();
  });

  it('creates a missing role with mapped permissions and isSystem', async () => {
    const { dataSource, roleRepo } = buildMocks();

    await seedRbac(dataSource as unknown as DataSource, {
      roles: [RoleKey.STORE_OWNER],
    });

    expect(roleRepo.findOneBy).toHaveBeenCalledWith({
      key: RoleKey.STORE_OWNER,
    });
    const saved = roleRepo.save.mock.calls[0][0] as Role;
    expect(saved).toMatchObject({
      key: RoleKey.STORE_OWNER,
      isSystem: true,
    });
    expect(saved.permissions).toHaveLength(
      SEED_ROLE_PERMISSIONS[RoleKey.STORE_OWNER].length,
    );
  });

  it('updates an existing role and keeps system protection', async () => {
    const { dataSource, roleRepo } = buildMocks();
    roleRepo.findOneBy.mockResolvedValue({
      id: 5,
      key: RoleKey.ADMIN,
      name: 'stale',
      description: 'stale',
    });

    await seedRbac(dataSource as unknown as DataSource, {
      roles: [RoleKey.ADMIN],
    });

    const saved = roleRepo.save.mock.calls[0][0] as Role;
    expect(saved.id).toBe(5);
    expect(saved.name).toBe('Admin');
    expect(saved.description).toBeTruthy();
    expect(saved.isSystem).toBe(true);
  });

  it('ignores unknown role keys', async () => {
    const { dataSource, roleRepo } = buildMocks();

    await seedRbac(dataSource as unknown as DataSource, {
      roles: ['NOT_A_ROLE' as RoleKey],
    });

    expect(roleRepo.findOneBy).not.toHaveBeenCalled();
    expect(roleRepo.save).not.toHaveBeenCalled();
  });

  it('filters out permission keys missing from the repository', async () => {
    const { dataSource, roleRepo } = buildMocks();

    await seedRbac(dataSource as unknown as DataSource, {
      roles: [RoleKey.CUSTOMER],
    });

    const saved = roleRepo.save.mock.calls[0][0] as Role;
    expect(saved.permissions?.length).toBeGreaterThan(0);
    expect(saved.permissions?.every((p) => p !== undefined && p !== null)).toBe(
      true,
    );
  });
});
