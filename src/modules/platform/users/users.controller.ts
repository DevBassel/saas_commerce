import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { Roles } from '../../auth/decorators/role.decorator';
import { Platform } from '../../auth/decorators/isPlatform.decorator';
import { RoleKey } from '../../../common/constants/RoleKey.enum';
import { UpdateUserDto } from '../../users/dto/update-user.dto';
import { AssignRoleDto } from '../../users/dto/assign-role.dto';
import { AssignPermissionsDto } from '../../users/dto/assign-permissions.dto';
import { RevokePermissionsDto } from '../../users/dto/revoke-permissions.dto';
import { PlatformUsersService } from './users.service';
import { PlatformCreateUserDto } from './dto/platform-create-user.dto';

@Platform()
@Controller('platform')
export class PlatformUsersController {
  constructor(private readonly usersService: PlatformUsersService) {}

  @Get('tenants/:tenantId/users')
  @Roles([RoleKey.SUPER_ADMIN])
  listTenantUsers(@Param('tenantId', ParseIntPipe) tenantId: number) {
    return this.usersService.listTenantUsers(tenantId);
  }

  @Get('tenants/:tenantId/users/:userId')
  @Roles([RoleKey.SUPER_ADMIN])
  getTenantUser(
    @Param('tenantId', ParseIntPipe) tenantId: number,
    @Param('userId', ParseIntPipe) userId: number,
  ) {
    return this.usersService.getTenantUser(tenantId, userId);
  }

  @Post('tenants/:tenantId/users')
  @Roles([RoleKey.SUPER_ADMIN])
  createTenantUser(
    @Param('tenantId', ParseIntPipe) tenantId: number,
    @Body() dto: PlatformCreateUserDto,
  ) {
    return this.usersService.createTenantUser(tenantId, dto);
  }

  @Patch('tenants/:tenantId/users/:userId')
  @Roles([RoleKey.SUPER_ADMIN])
  updateTenantUser(
    @Param('tenantId', ParseIntPipe) tenantId: number,
    @Param('userId', ParseIntPipe) userId: number,
    @Body() dto: UpdateUserDto,
  ) {
    return this.usersService.updateTenantUser(tenantId, userId, dto);
  }

  @Delete('tenants/:tenantId/users/:userId')
  @Roles([RoleKey.SUPER_ADMIN])
  removeTenantUser(
    @Param('tenantId', ParseIntPipe) tenantId: number,
    @Param('userId', ParseIntPipe) userId: number,
  ) {
    return this.usersService.removeTenantUser(tenantId, userId);
  }

  @Patch('tenants/:tenantId/users/:userId/role')
  @Roles([RoleKey.SUPER_ADMIN])
  assignTenantUserRole(
    @Param('tenantId', ParseIntPipe) tenantId: number,
    @Param('userId', ParseIntPipe) userId: number,
    @Body() dto: AssignRoleDto,
  ) {
    return this.usersService.assignTenantUserRole(tenantId, userId, dto);
  }

  @Delete('tenants/:tenantId/users/:userId/role')
  @Roles([RoleKey.SUPER_ADMIN])
  deassignTenantUserRole(
    @Param('tenantId', ParseIntPipe) tenantId: number,
    @Param('userId', ParseIntPipe) userId: number,
  ) {
    return this.usersService.deassignTenantUserRole(tenantId, userId);
  }

  @Post('tenants/:tenantId/users/:userId/permissions')
  @Roles([RoleKey.SUPER_ADMIN])
  grantTenantUserPermissions(
    @Param('tenantId', ParseIntPipe) tenantId: number,
    @Param('userId', ParseIntPipe) userId: number,
    @Body() dto: AssignPermissionsDto,
  ) {
    return this.usersService.grantTenantUserPermissions(tenantId, userId, dto);
  }

  @Delete('tenants/:tenantId/users/:userId/permissions')
  @Roles([RoleKey.SUPER_ADMIN])
  revokeTenantUserPermissions(
    @Param('tenantId', ParseIntPipe) tenantId: number,
    @Param('userId', ParseIntPipe) userId: number,
    @Body() dto: RevokePermissionsDto,
  ) {
    return this.usersService.revokeTenantUserPermissions(tenantId, userId, dto);
  }
}
