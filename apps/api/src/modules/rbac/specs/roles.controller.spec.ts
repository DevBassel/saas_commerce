import { Test } from '@nestjs/testing';
import { RolesController } from '../roles.controller';
import { RbacService } from '../rbac.service';
import { CreateRoleDto } from '../dto/create-role.dto';
import { UpdateRoleDto } from '../dto/update-role.dto';
import { RoleKey } from '../../../common/constants/RoleKey.enum';
import { RbacPermissionKey } from '../constants/rbac-permissions.enum';

const mockRbacService = {
  findAllRoles: jest.fn(),
  findRoleById: jest.fn(),
  createRole: jest.fn(),
  updateRole: jest.fn(),
  removeRole: jest.fn(),
};

describe('RolesController', () => {
  let controller: RolesController;
  let rbacService: typeof mockRbacService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [RolesController],
      providers: [{ provide: RbacService, useValue: mockRbacService }],
    }).compile();

    controller = moduleRef.get(RolesController);
    rbacService = moduleRef.get(RbacService);
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('delegates to RbacService.findAllRoles', async () => {
      const expected = [{ id: 1, key: RoleKey.CUSTOMER, name: 'Customer' }];
      rbacService.findAllRoles.mockResolvedValue(expected);

      const result = await controller.findAll();

      expect(rbacService.findAllRoles).toHaveBeenCalled();
      expect(result).toEqual(expected);
    });
  });

  describe('findOne', () => {
    it('delegates to RbacService.findRoleById with id', async () => {
      const expected = { id: 1, key: RoleKey.CUSTOMER, name: 'Customer' };
      rbacService.findRoleById.mockResolvedValue(expected);

      const result = await controller.findOne(1);

      expect(rbacService.findRoleById).toHaveBeenCalledWith(1);
      expect(result).toEqual(expected);
    });
  });

  describe('create', () => {
    it('delegates to RbacService.createRole with dto', async () => {
      const dto: CreateRoleDto = { key: 'custom_role', name: 'Custom Role' };
      const expected = { id: 2, key: 'custom_role', name: 'Custom Role' };
      rbacService.createRole.mockResolvedValue(expected);

      const result = await controller.create(dto);

      expect(rbacService.createRole).toHaveBeenCalledWith(dto);
      expect(result).toEqual(expected);
    });
  });

  describe('update', () => {
    it('delegates to RbacService.updateRole with id and dto', async () => {
      const dto: UpdateRoleDto = { name: 'Updated Role' };
      const expected = { id: 1, key: 'CUSTOM_ROLE', name: 'Updated Role' };
      rbacService.updateRole.mockResolvedValue(expected);

      const result = await controller.update(1, dto);

      expect(rbacService.updateRole).toHaveBeenCalledWith(1, dto);
      expect(result).toEqual(expected);
    });
  });

  describe('remove', () => {
    it('delegates to RbacService.removeRole with id', async () => {
      rbacService.removeRole.mockResolvedValue(undefined);

      const result = await controller.remove(1);

      expect(rbacService.removeRole).toHaveBeenCalledWith(1);
      expect(result).toBeUndefined();
    });
  });
});
