import { Test } from '@nestjs/testing';
import { UsersController } from '../users.controller';
import { UsersService } from '../users.service';
import { UpdateUserDto } from '../dto/update-user.dto';
import { ListUsersQueryDto } from '../dto/list-users.query.dto';
import { AssignRoleDto } from '../dto/assign-role.dto';
import { AssignPermissionsDto } from '../dto/assign-permissions.dto';
import { RevokePermissionsDto } from '../dto/revoke-permissions.dto';
import { RoleKey } from '../../../common/constants/RoleKey.enum';
import { PermissionKey } from '../../../common/constants/PermissionKey.enum';
import { UserPermissionKey } from '../constants/user-permissions.enum';
import type { RequestWithUser } from '../../auth/interfaces/RequestWithUser.interface';

const mockPresentUser = (user: any) => user;

jest.mock('../user.presenter', () => ({
  presentUser: (user: any) => mockPresentUser(user),
}));

const mockUsersService = {
  findOne: jest.fn(),
  findAll: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
  assignRole: jest.fn(),
  deassignRole: jest.fn(),
  grantPermissions: jest.fn(),
  revokePermissions: jest.fn(),
};

type PartialUser = Partial<RequestWithUser['user']> & { id: number };

const makeRequest = (
  overrides: { user?: PartialUser; tenant?: RequestWithUser['tenant'] } = {},
): RequestWithUser => {
  const baseUser = {
    id: 1,
    name: 'Test User',
    email: 'test@test.dev',
    emailVerified: true,
    role: { id: 1, key: RoleKey.CUSTOMER },
    permissions: [] as PermissionKey[],
  };
  const user = overrides.user ? { ...baseUser, ...overrides.user } : baseUser;
  return {
    user,
    tenant: overrides.tenant,
  } as RequestWithUser;
};

describe('UsersController', () => {
  let controller: UsersController;
  let usersService: typeof mockUsersService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [{ provide: UsersService, useValue: mockUsersService }],
    }).compile();

    controller = moduleRef.get(UsersController);
    usersService = moduleRef.get(UsersService);
    jest.clearAllMocks();
  });

  describe('getProfile', () => {
    it('returns the current user profile with permissions', async () => {
      const req = makeRequest({
        user: {
          id: 5,
          name: 'User',
          email: 'user@test.dev',
          emailVerified: true,
          role: { id: 1, key: RoleKey.ADMIN },
          permissions: ['test' as PermissionKey],
        },
      });
      const userEntity = {
        id: 5,
        email: 'user@test.dev',
        name: 'User',
        emailVerified: true,
        roleId: 1,
        role: { id: 1, key: RoleKey.ADMIN, name: 'Admin' },
        permissions: [{ id: 1, key: 'test', name: 'Test' }],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      usersService.findOne.mockResolvedValue(userEntity);

      const result = await controller.getProfile(req);

      expect(usersService.findOne).toHaveBeenCalledWith(
        { id: 5 },
        { withPermissions: true },
      );
      expect(result).toEqual({
        id: 5,
        name: 'User',
        email: 'user@test.dev',
        emailVerified: true,
        roleId: 1,
        role: { id: 1, key: RoleKey.ADMIN, name: 'Admin' },
        permissions: [{ id: 1, key: 'test', name: 'Test' }],
        createdAt: userEntity.createdAt,
        updatedAt: userEntity.updatedAt,
      });
    });

    it('throws NotFoundException when user not found', async () => {
      const req = makeRequest({
        user: {
          id: 999,
          name: 'Test',
          email: 'test@test.dev',
          emailVerified: true,
          role: { id: 1, key: RoleKey.CUSTOMER },
          permissions: [],
        },
      });
      usersService.findOne.mockResolvedValue(null);

      await expect(controller.getProfile(req)).rejects.toThrow('Not Found');
    });
  });

  describe('findOne', () => {
    it('delegates to UsersService.findOne with id and returns presented user', async () => {
      const userEntity = {
        id: 2,
        email: 'other@test.dev',
        name: 'Other',
        emailVerified: true,
        roleId: 1,
        role: { id: 1, key: RoleKey.ADMIN, name: 'Admin' },
        permissions: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      usersService.findOne.mockResolvedValue(userEntity);

      const result = await controller.findOne(2);

      expect(usersService.findOne).toHaveBeenCalledWith(
        { id: 2 },
        { withPermissions: true, withRole: true },
      );
      expect(result).toEqual({
        id: 2,
        name: 'Other',
        email: 'other@test.dev',
        emailVerified: true,
        roleId: 1,
        role: { id: 1, key: RoleKey.ADMIN, name: 'Admin' },
        permissions: [],
        createdAt: userEntity.createdAt,
        updatedAt: userEntity.updatedAt,
      });
    });

    it('returns null when user not found', async () => {
      usersService.findOne.mockResolvedValue(null);

      const result = await controller.findOne(999);

      expect(result).toBeNull();
    });
  });

  describe('findAll', () => {
    it('returns legacy array when no pagination', async () => {
      const users = [
        {
          id: 1,
          email: 'a@test.dev',
          name: 'A',
          emailVerified: true,
          roleId: null,
          role: null,
          permissions: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 2,
          email: 'b@test.dev',
          name: 'B',
          emailVerified: true,
          roleId: null,
          role: null,
          permissions: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ] as any;
      usersService.findAll.mockResolvedValue(users);

      const result = await controller.findAll({});

      expect(usersService.findAll).toHaveBeenCalledWith({});
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(2);
    });

    it('returns paginated envelope when page/limit provided', async () => {
      const paginated = {
        data: [
          {
            id: 1,
            email: 'a@test.dev',
            name: 'A',
            emailVerified: true,
            roleId: null,
            role: null,
            permissions: [],
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
        total: 1,
        page: 1,
        limit: 10,
      };
      usersService.findAll.mockResolvedValue(paginated);

      const result = await controller.findAll({ page: 1, limit: 10 });

      expect(usersService.findAll).toHaveBeenCalledWith({ page: 1, limit: 10 });
      expect(result).toEqual(paginated);
    });
  });

  describe('update', () => {
    it('delegates to UsersService.update with actor role and returns presented user', async () => {
      const req = makeRequest({
        user: {
          id: 1,
          role: { id: 1, key: RoleKey.STORE_OWNER },
          permissions: [],
        },
      });
      const dto: UpdateUserDto = { name: 'Updated' };
      const userEntity = {
        id: 2,
        email: 'user@test.dev',
        name: 'Updated',
        emailVerified: true,
        roleId: 1,
        role: { id: 1, key: RoleKey.CUSTOMER, name: 'Customer' },
        permissions: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      usersService.update.mockResolvedValue(userEntity);

      const result = await controller.update(2, dto, req);

      expect(usersService.update).toHaveBeenCalledWith(
        2,
        dto,
        RoleKey.STORE_OWNER,
      );
      expect(result).toEqual({
        id: 2,
        name: 'Updated',
        email: 'user@test.dev',
        emailVerified: true,
        roleId: 1,
        role: { id: 1, key: RoleKey.CUSTOMER, name: 'Customer' },
        permissions: [],
        createdAt: userEntity.createdAt,
        updatedAt: userEntity.updatedAt,
      });
    });

    it('defaults to CUSTOMER role when actor has no role', async () => {
      const req = makeRequest({ user: { id: 1, role: null, permissions: [] } });
      const dto: UpdateUserDto = { name: 'Updated' };
      usersService.update.mockResolvedValue({ id: 2 } as any);

      await controller.update(2, dto, req);

      expect(usersService.update).toHaveBeenCalledWith(
        2,
        dto,
        RoleKey.CUSTOMER,
      );
    });
  });

  describe('remove', () => {
    it('delegates to UsersService.remove with actor role', async () => {
      const req = makeRequest({
        user: {
          id: 1,
          role: { id: 1, key: RoleKey.STORE_OWNER },
          permissions: [],
        },
      });
      usersService.remove.mockResolvedValue({ deleted: true });

      const result = await controller.remove(2, req);

      expect(usersService.remove).toHaveBeenCalledWith(2, RoleKey.STORE_OWNER);
      expect(result).toEqual({ deleted: true });
    });
  });

  describe('assignRole', () => {
    it('delegates to UsersService.assignRole with actor role', async () => {
      const req = makeRequest({
        user: {
          id: 1,
          role: { id: 1, key: RoleKey.STORE_OWNER },
          permissions: [],
        },
      });
      const dto: AssignRoleDto = { roleId: 3 };
      const userEntity = {
        id: 2,
        email: 'user@test.dev',
        name: 'User',
        emailVerified: true,
        roleId: 3,
        role: { id: 3, key: RoleKey.ADMIN, name: 'Admin' },
        permissions: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      usersService.assignRole.mockResolvedValue(userEntity);

      const result = await controller.assignRole(2, dto, req);

      expect(usersService.assignRole).toHaveBeenCalledWith(
        2,
        3,
        RoleKey.STORE_OWNER,
      );
      expect(result).toEqual({
        id: 2,
        name: 'User',
        email: 'user@test.dev',
        emailVerified: true,
        roleId: 3,
        role: { id: 3, key: RoleKey.ADMIN, name: 'Admin' },
        permissions: [],
        createdAt: userEntity.createdAt,
        updatedAt: userEntity.updatedAt,
      });
    });
  });

  describe('deassignRole', () => {
    it('delegates to UsersService.deassignRole with actor role', async () => {
      const req = makeRequest({
        user: {
          id: 1,
          role: { id: 1, key: RoleKey.STORE_OWNER },
          permissions: [],
        },
      });
      const userEntity = {
        id: 2,
        email: 'user@test.dev',
        name: 'User',
        emailVerified: true,
        roleId: null,
        role: null,
        permissions: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      usersService.deassignRole.mockResolvedValue(userEntity);

      const result = await controller.deassignRole(2, req);

      expect(usersService.deassignRole).toHaveBeenCalledWith(
        2,
        RoleKey.STORE_OWNER,
      );
      expect(result).toEqual({
        id: 2,
        name: 'User',
        email: 'user@test.dev',
        emailVerified: true,
        roleId: null,
        role: null,
        permissions: [],
        createdAt: userEntity.createdAt,
        updatedAt: userEntity.updatedAt,
      });
    });
  });

  describe('grantPermissions', () => {
    it('delegates to UsersService.grantPermissions with actor role and permissions', async () => {
      const req = makeRequest({
        user: {
          id: 1,
          role: { id: 1, key: RoleKey.STORE_OWNER },
          permissions: ['test' as PermissionKey],
        },
      });
      const dto: AssignPermissionsDto = { permissionIds: [2, 3] };
      const userEntity = {
        id: 2,
        email: 'user@test.dev',
        name: 'User',
        emailVerified: true,
        roleId: 1,
        role: { id: 1, key: RoleKey.CUSTOMER, name: 'Customer' },
        permissions: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      usersService.grantPermissions.mockResolvedValue(userEntity);

      const result = await controller.grantPermissions(2, dto, req);

      expect(usersService.grantPermissions).toHaveBeenCalledWith(
        2,
        [2, 3],
        RoleKey.STORE_OWNER,
        ['test' as PermissionKey],
      );
      expect(result).toEqual({
        id: 2,
        name: 'User',
        email: 'user@test.dev',
        emailVerified: true,
        roleId: 1,
        role: { id: 1, key: RoleKey.CUSTOMER, name: 'Customer' },
        permissions: [],
        createdAt: userEntity.createdAt,
        updatedAt: userEntity.updatedAt,
      });
    });
  });

  describe('revokePermissions', () => {
    it('delegates to UsersService.revokePermissions with actor role', async () => {
      const req = makeRequest({
        user: {
          id: 1,
          role: { id: 1, key: RoleKey.STORE_OWNER },
          permissions: [],
        },
      });
      const dto: RevokePermissionsDto = { permissionIds: [2] };
      const userEntity = {
        id: 2,
        email: 'user@test.dev',
        name: 'User',
        emailVerified: true,
        roleId: 1,
        role: { id: 1, key: RoleKey.CUSTOMER, name: 'Customer' },
        permissions: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      usersService.revokePermissions.mockResolvedValue(userEntity);

      const result = await controller.revokePermissions(2, dto, req);

      expect(usersService.revokePermissions).toHaveBeenCalledWith(
        2,
        [2],
        RoleKey.STORE_OWNER,
      );
      expect(result).toEqual({
        id: 2,
        name: 'User',
        email: 'user@test.dev',
        emailVerified: true,
        roleId: 1,
        role: { id: 1, key: RoleKey.CUSTOMER, name: 'Customer' },
        permissions: [],
        createdAt: userEntity.createdAt,
        updatedAt: userEntity.updatedAt,
      });
    });

    it('defaults to empty array when permissionIds not provided', async () => {
      const req = makeRequest({
        user: {
          id: 1,
          role: { id: 1, key: RoleKey.STORE_OWNER },
          permissions: [],
        },
      });
      usersService.revokePermissions.mockResolvedValue({ id: 2 } as any);

      await controller.revokePermissions(2, {}, req);

      expect(usersService.revokePermissions).toHaveBeenCalledWith(
        2,
        [],
        RoleKey.STORE_OWNER,
      );
    });
  });
});
