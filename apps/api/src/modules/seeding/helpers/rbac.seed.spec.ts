import { Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { RoleKey } from 'src/common/constants/RoleKey.enum';
import { Permission } from 'src/modules/rbac/entities/permission.entity';
import { Role } from 'src/modules/rbac/entities/role.entity';
import {
  SEED_PERMISSIONS,
  SEED_ROLE_PERMISSIONS,
} from 'src/modules/rbac/constants/seed-data';
import {
  ensureBootstrapSuperAdmin,
  seedRbac,
  upsertPermissions,
  upsertRoles,
} from './rbac.seed';

const permissionEntities = SEED_PERMISSIONS.map((p, index) => ({
  id: index + 1,
  key: p.key,
  name: p.name,
  description: p.description,
}));

const buildHost = () => {
  const permissionRepo = {
    upsert: jest.fn().mockResolvedValue(undefined),
    find: jest.fn().mockResolvedValue(permissionEntities),
  };
  const roleRepo = {
    upsert: jest.fn().mockResolvedValue(undefined),
    findOne: jest.fn().mockResolvedValue(null),
    save: jest.fn((data: Role) => data),
  };
  const host = {
    getRepository: jest.fn((entity: unknown) =>
      entity === Permission ? permissionRepo : roleRepo,
    ),
  };

  return { host, permissionRepo, roleRepo };
};

describe('upsertPermissions / upsertRoles / seedRbac', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => jest.restoreAllMocks());

  it('upserts every seeded permission by key', async () => {
    const { host, permissionRepo } = buildHost();

    await upsertPermissions(host as unknown as DataSource);

    expect(host.getRepository).toHaveBeenCalledWith(Permission);
    expect(permissionRepo.upsert).toHaveBeenCalledWith(SEED_PERMISSIONS, [
      'key',
    ]);
  });

  it('upserts role rows and replaces their permission set', async () => {
    const { host, roleRepo } = buildHost();
    roleRepo.findOne.mockResolvedValue({
      id: 5,
      key: RoleKey.STORE_OWNER,
      name: 'stale',
      description: 'stale',
      permissions: [],
    });

    await upsertRoles(host as unknown as DataSource, [RoleKey.STORE_OWNER]);

    expect(roleRepo.upsert).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          key: RoleKey.STORE_OWNER,
          name: 'Store Owner',
          isSystem: true,
        }),
      ],
      ['key'],
    );
    const saved = roleRepo.save.mock.calls[0][0];
    expect(saved.id).toBe(5);
    expect(saved.isSystem).toBe(true);
    expect(saved.permissions).toHaveLength(
      SEED_ROLE_PERMISSIONS[RoleKey.STORE_OWNER].length,
    );
  });

  it('ignores unknown role keys', async () => {
    const { host, roleRepo } = buildHost();

    await upsertRoles(host as unknown as DataSource, ['NOT_A_ROLE' as RoleKey]);

    expect(roleRepo.upsert).not.toHaveBeenCalled();
    expect(roleRepo.save).not.toHaveBeenCalled();
  });

  it('seedRbac composes permissions then roles', async () => {
    const { host, permissionRepo, roleRepo } = buildHost();
    roleRepo.findOne.mockResolvedValue({
      id: 9,
      key: RoleKey.ADMIN,
      permissions: [],
    });

    await seedRbac(host as unknown as DataSource, {
      roles: [RoleKey.ADMIN],
    });

    expect(permissionRepo.upsert).toHaveBeenCalledTimes(1);
    expect(roleRepo.findOne).toHaveBeenCalledWith({
      where: { key: RoleKey.ADMIN },
      relations: { permissions: true },
    });
    expect(roleRepo.save).toHaveBeenCalledTimes(1);
  });
});

describe('ensureBootstrapSuperAdmin', () => {
  const SUPER_ADMIN_ROLE = { id: 77, key: RoleKey.SUPER_ADMIN };

  const buildDs = () => {
    const countQb = {
      leftJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getCount: jest.fn(),
    };
    const roleRepo = { findOneBy: jest.fn() };
    const permissionRepo = { find: jest.fn().mockResolvedValue([]) };
    const userRepo = {
      createQueryBuilder: jest.fn(() => countQb),
      findOneBy: jest.fn(),
      update: jest.fn().mockResolvedValue(undefined),
      findOne: jest.fn(),
      save: jest.fn((data: unknown) => data),
      create: jest.fn((data: unknown) => data),
    };
    const ds = {
      getRepository: jest.fn((entity: unknown) => {
        if (entity === Role) return roleRepo;
        if (entity === Permission) return permissionRepo;
        return userRepo;
      }),
    };

    return { ds, roleRepo, permissionRepo, userRepo, countQb };
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => jest.restoreAllMocks());

  it('does nothing when the SUPER_ADMIN role is missing', async () => {
    const { ds, roleRepo, userRepo } = buildDs();
    roleRepo.findOneBy.mockResolvedValue(null);

    await expect(
      ensureBootstrapSuperAdmin(ds as unknown as DataSource, {}),
    ).resolves.toBeUndefined();
    expect(userRepo.createQueryBuilder).not.toHaveBeenCalled();
  });

  it('skips when a SUPER_ADMIN user already exists', async () => {
    const { ds, roleRepo, countQb, userRepo } = buildDs();
    roleRepo.findOneBy.mockResolvedValue(SUPER_ADMIN_ROLE);
    countQb.getCount.mockResolvedValue(2);

    await ensureBootstrapSuperAdmin(ds as unknown as DataSource, {});

    expect(userRepo.save).not.toHaveBeenCalled();
  });

  it('throws when no super admin exists and env is missing', async () => {
    const { ds, roleRepo, countQb } = buildDs();
    roleRepo.findOneBy.mockResolvedValue(SUPER_ADMIN_ROLE);
    countQb.getCount.mockResolvedValue(0);

    await expect(
      ensureBootstrapSuperAdmin(ds as unknown as DataSource, {}),
    ).rejects.toThrow(/Refusing to boot without a platform super admin/);
  });

  it('promotes an existing user and merges permissions', async () => {
    const { ds, roleRepo, countQb, permissionRepo, userRepo } = buildDs();
    const permissions = [{ id: 1 }, { id: 2 }];
    roleRepo.findOneBy.mockResolvedValue(SUPER_ADMIN_ROLE);
    countQb.getCount.mockResolvedValue(0);
    permissionRepo.find.mockResolvedValue(permissions);
    userRepo.findOneBy.mockResolvedValue({ id: 5 });
    userRepo.findOne.mockResolvedValue({ id: 5, permissions: [{ id: 1 }] });

    await ensureBootstrapSuperAdmin(ds as unknown as DataSource, {
      email: 'root@test.dev',
      password: 'password',
    });

    expect(userRepo.update).toHaveBeenCalledWith(
      { id: 5 },
      { roleId: SUPER_ADMIN_ROLE.id },
    );
    expect(userRepo.save).toHaveBeenCalledWith({ id: 5, permissions });
  });

  it('creates a bootstrap super admin with default name and rounds', async () => {
    const { ds, roleRepo, countQb, permissionRepo, userRepo } = buildDs();
    const permissions = [{ id: 1 }];
    roleRepo.findOneBy.mockResolvedValue(SUPER_ADMIN_ROLE);
    countQb.getCount.mockResolvedValue(0);
    permissionRepo.find.mockResolvedValue(permissions);
    userRepo.findOneBy.mockResolvedValue(null);

    await ensureBootstrapSuperAdmin(ds as unknown as DataSource, {
      email: 'root@test.dev',
      password: 'password',
    });

    expect(userRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Super Admin',
        email: 'root@test.dev',
        emailVerified: true,
        roleId: SUPER_ADMIN_ROLE.id,
        permissions,
      }),
    );
  });
});
