import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import bcrypt from 'bcrypt';
import { UsersService } from './users.service';
import { User } from './entities/user.entity';
import { Role } from '../rbac/entities/role.entity';
import { Permission } from '../rbac/entities/permission.entity';
import { RoleKey } from '../../common/constants/RoleKey.enum';
import { SEED_ROLE_PERMISSIONS } from '../rbac/constants/seed-data';
import { TenantManagerService } from '../tenants/services/tenant-manager.service';

jest.mock('bcrypt', () => ({
  __esModule: true,
  default: {
    hash: jest.fn((value: string) => Promise.resolve(`hashed:${value}`)),
  },
}));

const TENANT = { schemaName: 'tenant_test' };

const DTO = {
  name: 'Jane',
  email: 'jane@example.com',
  password: 'password1',
};

const permissionObjects = (keys: string[]) =>
  keys.map((key, index) => ({ id: index + 1, key, name: key }));

const buildMocks = () => {
  const userRepo = {
    findOne: jest.fn().mockResolvedValue(null),
    create: jest.fn((data: unknown) => data),
    save: jest.fn((data: unknown) => data),
  };
  const roleRepo = {
    findOneBy: jest.fn(),
  };
  roleRepo.findOneBy.mockImplementation(({ key }: { key: RoleKey }) => ({
    id: 10,
    key,
  }));
  const permissionRepo = {
    findBy: jest.fn(),
  };
  permissionRepo.findBy.mockImplementation(
    (where: { key: { value: string[] } }) => permissionObjects(where.key.value),
  );

  const tenantManager = {
    getRepository: jest.fn((entity: unknown) => {
      if (entity === User) return Promise.resolve(userRepo);
      if (entity === Role) return Promise.resolve(roleRepo);
      return Promise.resolve(permissionRepo);
    }),
  } as unknown as TenantManagerService;

  const service = new UsersService(
    userRepo as unknown as Repository<User>,
    roleRepo as unknown as Repository<Role>,
    permissionRepo as unknown as Repository<Permission>,
    tenantManager,
  );

  return { service, userRepo, roleRepo, permissionRepo };
};

describe('UsersService.create', () => {
  const bcryptHash = bcrypt.hash as jest.MockedFunction<typeof bcrypt.hash>;

  beforeEach(() => {
    bcryptHash.mockClear();
  });

  it.each<RoleKey>([RoleKey.CUSTOMER, RoleKey.STORE_OWNER, RoleKey.ADMIN])(
    'grants the seeded %s permission snapshot as direct permissions',
    async (roleKey) => {
      const { service, userRepo, permissionRepo } = buildMocks();
      const keys = SEED_ROLE_PERMISSIONS[roleKey];

      const result = await service.create({ ...DTO }, roleKey, TENANT);

      const [[where]] = permissionRepo.findBy.mock.calls as unknown as Array<
        [{ key: { value: string[] } }]
      >;
      expect(where.key.value).toEqual(keys);
      expect(result).toMatchObject({
        roleId: 10,
        permissions: permissionObjects(keys),
      });
      expect(userRepo.save).toHaveBeenCalledTimes(1);
    },
  );

  it('rejects SUPER_ADMIN without saving', async () => {
    const { service, userRepo, permissionRepo } = buildMocks();

    await expect(
      service.create({ ...DTO }, RoleKey.SUPER_ADMIN, TENANT),
    ).rejects.toThrow(ForbiddenException);
    expect(userRepo.save).not.toHaveBeenCalled();
    expect(permissionRepo.findBy).not.toHaveBeenCalled();
  });

  it('skips permission keys missing from the schema and still saves', async () => {
    const { service, userRepo, permissionRepo } = buildMocks();
    const keys = SEED_ROLE_PERMISSIONS[RoleKey.ADMIN];
    const subset = permissionObjects(keys.slice(0, 2));
    permissionRepo.findBy.mockResolvedValue(subset);

    const result = await service.create({ ...DTO }, RoleKey.ADMIN, TENANT);

    expect(result).toMatchObject({ permissions: subset });
    expect(userRepo.save).toHaveBeenCalledTimes(1);
  });

  it('rejects when the role is not seeded in the schema', async () => {
    const { service, userRepo, roleRepo, permissionRepo } = buildMocks();
    roleRepo.findOneBy.mockResolvedValue(null);

    await expect(
      service.create({ ...DTO }, RoleKey.CUSTOMER, TENANT),
    ).rejects.toThrow('role not seeded');
    expect(permissionRepo.findBy).not.toHaveBeenCalled();
    expect(userRepo.save).not.toHaveBeenCalled();
  });

  it('rejects a duplicate email before resolving permissions', async () => {
    const { service, userRepo, roleRepo, permissionRepo } = buildMocks();
    userRepo.findOne.mockResolvedValue({ id: 1, email: DTO.email });

    await expect(
      service.create({ ...DTO }, RoleKey.CUSTOMER, TENANT),
    ).rejects.toThrow('user already exists');
    expect(roleRepo.findOneBy).not.toHaveBeenCalled();
    expect(permissionRepo.findBy).not.toHaveBeenCalled();
    expect(userRepo.save).not.toHaveBeenCalled();
  });

  it('hashes the password and assigns the role id', async () => {
    const { service } = buildMocks();

    const result = await service.create({ ...DTO }, RoleKey.CUSTOMER, TENANT);

    expect(bcryptHash).toHaveBeenCalledWith(DTO.password, 12);
    expect(result).toMatchObject({
      email: DTO.email,
      password: `hashed:${DTO.password}`,
      roleId: 10,
    });
  });
});

describe('UsersService.assignRole', () => {
  const STALE = [{ id: 99, key: 'product.read', name: 'product.read' }];

  const savedUser = (userRepo: { save: jest.Mock<unknown, [unknown]> }) =>
    userRepo.save.mock.calls[0][0] as {
      roleId: number;
      permissions: unknown[];
    };

  it('replaces direct grants with the seeded snapshot of a system role', async () => {
    const { service, userRepo, roleRepo, permissionRepo } = buildMocks();
    roleRepo.findOneBy.mockResolvedValue({ id: 10, key: RoleKey.ADMIN });
    userRepo.findOne
      .mockResolvedValueOnce({ id: 5, roleId: 1, permissions: STALE })
      .mockResolvedValueOnce({ id: 5, roleId: 1, permissions: [...STALE] });
    const keys = SEED_ROLE_PERMISSIONS[RoleKey.ADMIN];

    await service.assignRole(5, 10, RoleKey.STORE_OWNER, TENANT);

    const [[where]] = permissionRepo.findBy.mock.calls as unknown as Array<
      [{ key: { value: string[] } }]
    >;
    expect(where.key.value).toEqual(keys);
    expect(userRepo.save).toHaveBeenCalledTimes(1);
    expect(savedUser(userRepo)).toMatchObject({
      roleId: 10,
      permissions: permissionObjects(keys),
    });
  });

  it('clears direct grants when the target role is custom', async () => {
    const { service, userRepo, roleRepo, permissionRepo } = buildMocks();
    roleRepo.findOneBy.mockResolvedValue({ id: 20, key: 'assistant' });
    userRepo.findOne
      .mockResolvedValueOnce({ id: 5, roleId: 1, permissions: STALE })
      .mockResolvedValueOnce({ id: 5, roleId: 1, permissions: [...STALE] });

    await service.assignRole(5, 20, RoleKey.STORE_OWNER, TENANT);

    expect(permissionRepo.findBy).not.toHaveBeenCalled();
    expect(savedUser(userRepo)).toMatchObject({
      roleId: 20,
      permissions: [],
    });
  });

  it('assigns the subset of seeded keys that exist in the schema', async () => {
    const { service, userRepo, roleRepo, permissionRepo } = buildMocks();
    roleRepo.findOneBy.mockResolvedValue({ id: 10, key: RoleKey.ADMIN });
    userRepo.findOne
      .mockResolvedValueOnce({ id: 5, roleId: 1, permissions: STALE })
      .mockResolvedValueOnce({ id: 5, roleId: 1, permissions: [...STALE] });
    const subset = permissionObjects(
      SEED_ROLE_PERMISSIONS[RoleKey.ADMIN].slice(0, 2),
    );
    permissionRepo.findBy.mockResolvedValue(subset);

    await service.assignRole(5, 10, RoleKey.STORE_OWNER, TENANT);

    expect(savedUser(userRepo)).toMatchObject({ permissions: subset });
  });

  it('rejects when the actor cannot assign the target rank and writes nothing', async () => {
    const { service, userRepo, roleRepo, permissionRepo } = buildMocks();
    roleRepo.findOneBy.mockResolvedValue({ id: 10, key: RoleKey.ADMIN });
    userRepo.findOne.mockResolvedValueOnce({ id: 5, roleId: 1 });

    await expect(
      service.assignRole(5, 10, RoleKey.CUSTOMER, TENANT),
    ).rejects.toThrow(ForbiddenException);

    expect(permissionRepo.findBy).not.toHaveBeenCalled();
    expect(userRepo.save).not.toHaveBeenCalled();
  });

  it('rejects when the role does not exist in the schema', async () => {
    const { service, userRepo, roleRepo, permissionRepo } = buildMocks();
    roleRepo.findOneBy.mockResolvedValue(null);
    userRepo.findOne.mockResolvedValueOnce({ id: 5, roleId: 1 });

    await expect(
      service.assignRole(5, 999, RoleKey.STORE_OWNER, TENANT),
    ).rejects.toThrow(NotFoundException);

    expect(permissionRepo.findBy).not.toHaveBeenCalled();
    expect(userRepo.save).not.toHaveBeenCalled();
  });

  it('is idempotent when reassigning the same role', async () => {
    const { service, userRepo, roleRepo } = buildMocks();
    roleRepo.findOneBy.mockResolvedValue({ id: 10, key: RoleKey.ADMIN });
    userRepo.findOne
      .mockResolvedValueOnce({ id: 5, roleId: 10 })
      .mockResolvedValueOnce({ id: 5, roleId: 10, permissions: [] })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 5, roleId: 10 })
      .mockResolvedValueOnce({ id: 5, roleId: 10, permissions: [] })
      .mockResolvedValueOnce(null);
    const expected = permissionObjects(SEED_ROLE_PERMISSIONS[RoleKey.ADMIN]);

    await service.assignRole(5, 10, RoleKey.STORE_OWNER, TENANT);
    await service.assignRole(5, 10, RoleKey.STORE_OWNER, TENANT);

    expect(userRepo.save).toHaveBeenCalledTimes(2);
    expect(userRepo.save.mock.calls[0][0]).toMatchObject({
      roleId: 10,
      permissions: expected,
    });
    expect(userRepo.save.mock.calls[1][0]).toMatchObject({
      roleId: 10,
      permissions: expected,
    });
  });
});
