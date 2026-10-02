import { Logger } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import bcrypt from 'bcrypt';
import { ConfigService } from '@nestjs/config';
import { IENV } from 'src/common/config/env.interface';
import { RoleKey } from 'src/common/constants/RoleKey.enum';
import { Permission } from './entities/permission.entity';
import { Role } from './entities/role.entity';
import { User } from '../users/entities/user.entity';
import { RbacSeedService } from './rbac.seed.service';
import { seedRbac } from './rbac.seed';

jest.mock('bcrypt', () => ({
  __esModule: true,
  default: {
    hash: jest.fn((value: string) => Promise.resolve(`hashed:${value}`)),
  },
}));

jest.mock('./rbac.seed', () => ({
  seedRbac: jest.fn().mockResolvedValue(undefined),
}));

const seedRbacMock = seedRbac as jest.Mock;
const bcryptHash = bcrypt.hash as jest.MockedFunction<typeof bcrypt.hash>;

const SUPER_ADMIN_ROLE = { id: 77, key: RoleKey.SUPER_ADMIN };

const buildMocks = () => {
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
  const dataSource = { name: 'data-source' } as unknown as DataSource;

  return { roleRepo, permissionRepo, userRepo, dataSource, countQb };
};

const buildConfig = (app: Record<string, unknown>, rounds = 12) =>
  ({
    getOrThrow: jest.fn((key: string) =>
      key === 'app' ? app : key === 'bcrypt' ? { rounds } : undefined,
    ),
  }) as unknown as ConfigService<IENV>;

const buildService = (
  mocks: ReturnType<typeof buildMocks>,
  config: ConfigService<IENV>,
) =>
  new RbacSeedService(
    mocks.roleRepo as unknown as Repository<Role>,
    mocks.permissionRepo as unknown as Repository<Permission>,
    mocks.userRepo as unknown as Repository<User>,
    mocks.dataSource,
    config,
  );

describe('RbacSeedService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('seeds public RBAC for SUPER_ADMIN then ensures a super admin', async () => {
    const mocks = buildMocks();
    mocks.roleRepo.findOneBy.mockResolvedValue(SUPER_ADMIN_ROLE);
    mocks.countQb.getCount.mockResolvedValue(1);
    const service = buildService(mocks, buildConfig({}));

    await service.seed();

    expect(seedRbacMock).toHaveBeenCalledWith(mocks.dataSource, {
      roles: [RoleKey.SUPER_ADMIN],
    });
  });

  it('runs the seed on application bootstrap', async () => {
    const mocks = buildMocks();
    mocks.roleRepo.findOneBy.mockResolvedValue(SUPER_ADMIN_ROLE);
    mocks.countQb.getCount.mockResolvedValue(1);
    const service = buildService(mocks, buildConfig({}));
    const seedSpy = jest.spyOn(service, 'seed');

    await service.onApplicationBootstrap();

    expect(seedSpy).toHaveBeenCalledTimes(1);
  });

  it('does nothing when the SUPER_ADMIN role is missing', async () => {
    const mocks = buildMocks();
    mocks.roleRepo.findOneBy.mockResolvedValue(null);
    const service = buildService(mocks, buildConfig({}));

    await expect(service.seed()).resolves.toBeUndefined();
    expect(mocks.userRepo.createQueryBuilder).not.toHaveBeenCalled();
  });

  it('skips bootstrap when a SUPER_ADMIN user already exists', async () => {
    const mocks = buildMocks();
    mocks.roleRepo.findOneBy.mockResolvedValue(SUPER_ADMIN_ROLE);
    mocks.countQb.getCount.mockResolvedValue(2);
    const service = buildService(mocks, buildConfig({}));

    await service.seed();

    expect(mocks.userRepo.save).not.toHaveBeenCalled();
    expect(bcryptHash).not.toHaveBeenCalled();
  });

  it('refuses to boot when no super admin exists and env is missing', async () => {
    const mocks = buildMocks();
    mocks.roleRepo.findOneBy.mockResolvedValue(SUPER_ADMIN_ROLE);
    mocks.countQb.getCount.mockResolvedValue(0);
    const service = buildService(mocks, buildConfig({}));

    await expect(service.seed()).rejects.toThrow(
      /Refusing to boot without a platform super admin/,
    );
  });

  it('promotes an existing user to SUPER_ADMIN and grants all permissions', async () => {
    const mocks = buildMocks();
    const permissions = [{ id: 1 }, { id: 2 }];
    mocks.roleRepo.findOneBy.mockResolvedValue(SUPER_ADMIN_ROLE);
    mocks.countQb.getCount.mockResolvedValue(0);
    mocks.permissionRepo.find.mockResolvedValue(permissions);
    mocks.userRepo.findOneBy.mockResolvedValue({ id: 5 });
    mocks.userRepo.findOne.mockResolvedValue({
      id: 5,
      permissions: [{ id: 1 }],
    });
    const service = buildService(
      mocks,
      buildConfig({
        bootstrapSuperAdminEmail: 'root@test.dev',
        bootstrapSuperAdminPassword: 'password',
      }),
    );

    await service.seed();

    expect(mocks.userRepo.update).toHaveBeenCalledWith(
      { id: 5 },
      { roleId: SUPER_ADMIN_ROLE.id },
    );
    expect(mocks.userRepo.save).toHaveBeenCalledWith({
      id: 5,
      permissions,
    });
    expect(bcryptHash).not.toHaveBeenCalled();
  });

  it('creates a bootstrap super admin with the configured bcrypt rounds', async () => {
    const mocks = buildMocks();
    const permissions = [{ id: 1 }];
    mocks.roleRepo.findOneBy.mockResolvedValue(SUPER_ADMIN_ROLE);
    mocks.countQb.getCount.mockResolvedValue(0);
    mocks.permissionRepo.find.mockResolvedValue(permissions);
    mocks.userRepo.findOneBy.mockResolvedValue(null);
    const service = buildService(
      mocks,
      buildConfig(
        {
          bootstrapSuperAdminEmail: 'root@test.dev',
          bootstrapSuperAdminPassword: 'password',
          bootstrapSuperAdminName: 'Root',
        },
        4,
      ),
    );

    await service.seed();

    expect(bcryptHash).toHaveBeenCalledWith('password', 4);
    expect(mocks.userRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Root',
        email: 'root@test.dev',
        password: 'hashed:password',
        emailVerified: true,
        roleId: SUPER_ADMIN_ROLE.id,
        permissions,
      }),
    );
  });

  it('defaults the super admin name and bcrypt rounds', async () => {
    const mocks = buildMocks();
    mocks.roleRepo.findOneBy.mockResolvedValue(SUPER_ADMIN_ROLE);
    mocks.countQb.getCount.mockResolvedValue(0);
    mocks.permissionRepo.find.mockResolvedValue([]);
    mocks.userRepo.findOneBy.mockResolvedValue(null);
    const service = buildService(
      mocks,
      buildConfig(
        {
          bootstrapSuperAdminEmail: 'root@test.dev',
          bootstrapSuperAdminPassword: 'password',
        },
        0,
      ),
    );

    await service.seed();

    expect(bcryptHash).toHaveBeenCalledWith('password', 12);
    expect(mocks.userRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Super Admin' }),
    );
  });
});
