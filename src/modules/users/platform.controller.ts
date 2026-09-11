import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { Roles } from '../auth/decorators/role.decorator';
import { Platform } from '../auth/decorators/isPlatform.decorator';
import { RoleKey } from '../../common/constants/RoleKey.enum';
import { TenantService } from '../tenants/tenant.service';
import { UsersService } from './users.service';
import { PlatformCreateUserDto } from './dto/platform-create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { AssignRoleDto } from './dto/assign-role.dto';
import { AssignPermissionsDto } from './dto/assign-permissions.dto';
import { RevokePermissionsDto } from './dto/revoke-permissions.dto';
import { RbacService } from '../rbac/rbac.service';
import { CreateRoleDto } from '../rbac/dto/create-role.dto';
import { UpdateRoleDto } from '../rbac/dto/update-role.dto';
import { CreatePermissionDto } from '../rbac/dto/create-permission.dto';
import { UpdatePermissionDto } from '../rbac/dto/update-permission.dto';

@Platform()
@Controller('platform')
export class PlatformController {
  constructor(
    private readonly tenantService: TenantService,
    private readonly usersService: UsersService,
    private readonly rbacService: RbacService,
  ) {}

  @Get('tenants')
  @Roles([RoleKey.SUPER_ADMIN])
  listTenants() {
    return this.tenantService.findAll();
  }

  @Get('tenants/:id')
  @Roles([RoleKey.SUPER_ADMIN])
  getTenant(@Param('id', ParseIntPipe) id: number) {
    return this.tenantService.findByIdWithOwner(id);
  }

  private async tenantRef(tenantId: number) {
    const tenant = await this.tenantService.findById(tenantId);
    return { schemaName: tenant.schemaName };
  }

  // ---- Users ----

  @Get('tenants/:tenantId/users')
  @Roles([RoleKey.SUPER_ADMIN])
  async listTenantUsers(@Param('tenantId', ParseIntPipe) tenantId: number) {
    return this.usersService.findAll(await this.tenantRef(tenantId));
  }

  @Get('tenants/:tenantId/users/:userId')
  @Roles([RoleKey.SUPER_ADMIN])
  async getTenantUser(
    @Param('tenantId', ParseIntPipe) tenantId: number,
    @Param('userId', ParseIntPipe) userId: number,
  ) {
    return this.usersService.findOne(
      { id: userId },
      { withPermissions: true, withRole: true },
      await this.tenantRef(tenantId),
    );
  }

  @Post('tenants/:tenantId/users')
  @Roles([RoleKey.SUPER_ADMIN])
  async createTenantUser(
    @Param('tenantId', ParseIntPipe) tenantId: number,
    @Body() dto: PlatformCreateUserDto,
  ) {
    const { roleKey, ...createUserDto } = dto;
    return this.usersService.create(
      createUserDto,
      roleKey ?? RoleKey.CUSTOMER,
      await this.tenantRef(tenantId),
    );
  }

  @Patch('tenants/:tenantId/users/:userId')
  @Roles([RoleKey.SUPER_ADMIN])
  async updateTenantUser(
    @Param('tenantId', ParseIntPipe) tenantId: number,
    @Param('userId', ParseIntPipe) userId: number,
    @Body() dto: UpdateUserDto,
  ) {
    return this.usersService.update(
      userId,
      dto,
      await this.tenantRef(tenantId),
    );
  }

  @Delete('tenants/:tenantId/users/:userId')
  @Roles([RoleKey.SUPER_ADMIN])
  async removeTenantUser(
    @Param('tenantId', ParseIntPipe) tenantId: number,
    @Param('userId', ParseIntPipe) userId: number,
  ) {
    return this.usersService.remove(userId, await this.tenantRef(tenantId));
  }

  @Patch('tenants/:tenantId/users/:userId/role')
  @Roles([RoleKey.SUPER_ADMIN])
  async assignTenantUserRole(
    @Param('tenantId', ParseIntPipe) tenantId: number,
    @Param('userId', ParseIntPipe) userId: number,
    @Body() dto: AssignRoleDto,
  ) {
    return this.usersService.assignRole(
      userId,
      dto.roleId,
      RoleKey.SUPER_ADMIN,
      await this.tenantRef(tenantId),
    );
  }

  @Delete('tenants/:tenantId/users/:userId/role')
  @Roles([RoleKey.SUPER_ADMIN])
  async deassignTenantUserRole(
    @Param('tenantId', ParseIntPipe) tenantId: number,
    @Param('userId', ParseIntPipe) userId: number,
  ) {
    return this.usersService.deassignRole(
      userId,
      RoleKey.SUPER_ADMIN,
      await this.tenantRef(tenantId),
    );
  }

  @Post('tenants/:tenantId/users/:userId/permissions')
  @Roles([RoleKey.SUPER_ADMIN])
  async grantTenantUserPermissions(
    @Param('tenantId', ParseIntPipe) tenantId: number,
    @Param('userId', ParseIntPipe) userId: number,
    @Body() dto: AssignPermissionsDto,
  ) {
    return this.usersService.grantPermissions(
      userId,
      dto.permissionIds,
      RoleKey.SUPER_ADMIN,
      [],
      await this.tenantRef(tenantId),
    );
  }

  @Delete('tenants/:tenantId/users/:userId/permissions')
  @Roles([RoleKey.SUPER_ADMIN])
  async revokeTenantUserPermissions(
    @Param('tenantId', ParseIntPipe) tenantId: number,
    @Param('userId', ParseIntPipe) userId: number,
    @Body() dto: RevokePermissionsDto,
  ) {
    return this.usersService.revokePermissions(
      userId,
      dto.permissionIds ?? [],
      RoleKey.SUPER_ADMIN,
      await this.tenantRef(tenantId),
    );
  }

  // ---- Roles ----

  @Get('tenants/:tenantId/roles')
  @Roles([RoleKey.SUPER_ADMIN])
  async listTenantRoles(
    @Param('tenantId', ParseIntPipe) tenantId: number,
  ) {
    return this.rbacService.findAllRoles(await this.tenantRef(tenantId));
  }

  @Get('tenants/:tenantId/roles/:roleId')
  @Roles([RoleKey.SUPER_ADMIN])
  async getTenantRole(
    @Param('tenantId', ParseIntPipe) tenantId: number,
    @Param('roleId', ParseIntPipe) roleId: number,
  ) {
    return this.rbacService.findRoleById(roleId, await this.tenantRef(tenantId));
  }

  @Post('tenants/:tenantId/roles')
  @Roles([RoleKey.SUPER_ADMIN])
  async createTenantRole(
    @Param('tenantId', ParseIntPipe) tenantId: number,
    @Body() dto: CreateRoleDto,
  ) {
    return this.rbacService.createRole(dto, await this.tenantRef(tenantId));
  }

  @Patch('tenants/:tenantId/roles/:roleId')
  @Roles([RoleKey.SUPER_ADMIN])
  async updateTenantRole(
    @Param('tenantId', ParseIntPipe) tenantId: number,
    @Param('roleId', ParseIntPipe) roleId: number,
    @Body() dto: UpdateRoleDto,
  ) {
    return this.rbacService.updateRole(
      roleId,
      dto,
      await this.tenantRef(tenantId),
    );
  }

  @Delete('tenants/:tenantId/roles/:roleId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles([RoleKey.SUPER_ADMIN])
  async removeTenantRole(
    @Param('tenantId', ParseIntPipe) tenantId: number,
    @Param('roleId', ParseIntPipe) roleId: number,
  ) {
    return this.rbacService.removeRole(
      roleId,
      await this.tenantRef(tenantId),
    );
  }

  // ---- Permissions ----

  @Get('tenants/:tenantId/permissions')
  @Roles([RoleKey.SUPER_ADMIN])
  async listTenantPermissions(
    @Param('tenantId', ParseIntPipe) tenantId: number,
  ) {
    return this.rbacService.findAllPermissions(
      await this.tenantRef(tenantId),
    );
  }

  @Post('tenants/:tenantId/permissions')
  @Roles([RoleKey.SUPER_ADMIN])
  async createTenantPermission(
    @Param('tenantId', ParseIntPipe) tenantId: number,
    @Body() dto: CreatePermissionDto,
  ) {
    return this.rbacService.createPermission(
      dto,
      await this.tenantRef(tenantId),
    );
  }

  @Patch('tenants/:tenantId/permissions/:permissionId')
  @Roles([RoleKey.SUPER_ADMIN])
  async updateTenantPermission(
    @Param('tenantId', ParseIntPipe) tenantId: number,
    @Param('permissionId', ParseIntPipe) permissionId: number,
    @Body() dto: UpdatePermissionDto,
  ) {
    return this.rbacService.updatePermission(
      permissionId,
      dto,
      await this.tenantRef(tenantId),
    );
  }

  @Delete('tenants/:tenantId/permissions/:permissionId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles([RoleKey.SUPER_ADMIN])
  async removeTenantPermission(
    @Param('tenantId', ParseIntPipe) tenantId: number,
    @Param('permissionId', ParseIntPipe) permissionId: number,
  ) {
    return this.rbacService.removePermission(
      permissionId,
      await this.tenantRef(tenantId),
    );
  }
}
