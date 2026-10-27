import { Test } from '@nestjs/testing';
import { PermissionsController } from '../permissions.controller';
import { RbacService } from '../rbac.service';
import { CreatePermissionDto } from '../dto/create-permission.dto';
import { UpdatePermissionDto } from '../dto/update-permission.dto';
import { RbacPermissionKey } from '../constants/rbac-permissions.enum';

const mockRbacService = {
  findAllPermissions: jest.fn(),
  createPermission: jest.fn(),
  updatePermission: jest.fn(),
  removePermission: jest.fn(),
};

describe('PermissionsController', () => {
  let controller: PermissionsController;
  let rbacService: typeof mockRbacService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [PermissionsController],
      providers: [{ provide: RbacService, useValue: mockRbacService }],
    }).compile();

    controller = moduleRef.get(PermissionsController);
    rbacService = moduleRef.get(RbacService);
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('delegates to RbacService.findAllPermissions', async () => {
      const expected = [{ id: 1, key: 'products:read', name: 'Read Products' }];
      rbacService.findAllPermissions.mockResolvedValue(expected);

      const result = await controller.findAll();

      expect(rbacService.findAllPermissions).toHaveBeenCalled();
      expect(result).toEqual(expected);
    });
  });

  describe('create', () => {
    it('delegates to RbacService.createPermission with dto', async () => {
      const dto: CreatePermissionDto = {
        key: RbacPermissionKey.PERMISSIONS_CREATE,
        name: 'Create Permissions',
      };
      const expected = {
        id: 2,
        key: RbacPermissionKey.PERMISSIONS_CREATE,
        name: 'Create Permissions',
      };
      rbacService.createPermission.mockResolvedValue(expected);

      const result = await controller.create(dto);

      expect(rbacService.createPermission).toHaveBeenCalledWith(dto);
      expect(result).toEqual(expected);
    });
  });

  describe('update', () => {
    it('delegates to RbacService.updatePermission with id and dto', async () => {
      const dto: UpdatePermissionDto = { name: 'Updated Action' };
      const expected = { id: 1, key: 'custom:action', name: 'Updated Action' };
      rbacService.updatePermission.mockResolvedValue(expected);

      const result = await controller.update(1, dto);

      expect(rbacService.updatePermission).toHaveBeenCalledWith(1, dto);
      expect(result).toEqual(expected);
    });
  });

  describe('remove', () => {
    it('delegates to RbacService.removePermission with id', async () => {
      rbacService.removePermission.mockResolvedValue(undefined);

      const result = await controller.remove(1);

      expect(rbacService.removePermission).toHaveBeenCalledWith(1);
      expect(result).toBeUndefined();
    });
  });
});
