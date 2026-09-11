import { Injectable } from '@nestjs/common';
import { UsersService } from '../../users/users.service';
import { UpdateUserDto } from '../../users/dto/update-user.dto';
import { AssignRoleDto } from '../../users/dto/assign-role.dto';
import { AssignPermissionsDto } from '../../users/dto/assign-permissions.dto';
import { RevokePermissionsDto } from '../../users/dto/revoke-permissions.dto';
import { RoleKey } from '../../../common/constants/RoleKey.enum';
import { PlatformCreateUserDto } from './dto/platform-create-user.dto';
import {
  PlatformTenantRefService,
  TenantRef,
} from '../common/tenant-ref.service';

@Injectable()
export class PlatformUsersService {
  constructor(
    private readonly tenantRefService: PlatformTenantRefService,
    private readonly usersService: UsersService,
  ) {}

  private tenantRef(tenantId: number): Promise<TenantRef> {
    return this.tenantRefService.resolve(tenantId);
  }

  async listTenantUsers(tenantId: number) {
    return this.usersService.findAll(await this.tenantRef(tenantId));
  }

  async getTenantUser(tenantId: number, userId: number) {
    return this.usersService.findOne(
      { id: userId },
      { withPermissions: true, withRole: true },
      await this.tenantRef(tenantId),
    );
  }

  async createTenantUser(tenantId: number, dto: PlatformCreateUserDto) {
    const { roleKey, ...createUserDto } = dto;
    return this.usersService.create(
      createUserDto,
      roleKey ?? RoleKey.CUSTOMER,
      await this.tenantRef(tenantId),
    );
  }

  async updateTenantUser(tenantId: number, userId: number, dto: UpdateUserDto) {
    return this.usersService.update(
      userId,
      dto,
      await this.tenantRef(tenantId),
    );
  }

  async removeTenantUser(tenantId: number, userId: number) {
    return this.usersService.remove(userId, await this.tenantRef(tenantId));
  }

  async assignTenantUserRole(
    tenantId: number,
    userId: number,
    dto: AssignRoleDto,
  ) {
    return this.usersService.assignRole(
      userId,
      dto.roleId,
      RoleKey.SUPER_ADMIN,
      await this.tenantRef(tenantId),
    );
  }

  async deassignTenantUserRole(tenantId: number, userId: number) {
    return this.usersService.deassignRole(
      userId,
      RoleKey.SUPER_ADMIN,
      await this.tenantRef(tenantId),
    );
  }

  async grantTenantUserPermissions(
    tenantId: number,
    userId: number,
    dto: AssignPermissionsDto,
  ) {
    return this.usersService.grantPermissions(
      userId,
      dto.permissionIds,
      RoleKey.SUPER_ADMIN,
      [],
      await this.tenantRef(tenantId),
    );
  }

  async revokeTenantUserPermissions(
    tenantId: number,
    userId: number,
    dto: RevokePermissionsDto,
  ) {
    return this.usersService.revokePermissions(
      userId,
      dto.permissionIds ?? [],
      RoleKey.SUPER_ADMIN,
      await this.tenantRef(tenantId),
    );
  }
}
