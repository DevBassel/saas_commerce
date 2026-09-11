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
import { Roles } from '../../auth/decorators/role.decorator';
import { Platform } from '../../auth/decorators/isPlatform.decorator';
import { RoleKey } from '../../../common/constants/RoleKey.enum';
import { CreateRoleDto } from '../../rbac/dto/create-role.dto';
import { UpdateRoleDto } from '../../rbac/dto/update-role.dto';
import { PlatformRolesService } from './roles.service';

@Platform()
@Roles([RoleKey.SUPER_ADMIN])
@Controller('platform')
export class PlatformRolesController {
  constructor(private readonly rolesService: PlatformRolesService) {}

  @Get('tenants/:tenantId/roles')
  listTenantRoles(@Param('tenantId', ParseIntPipe) tenantId: number) {
    return this.rolesService.listTenantRoles(tenantId);
  }

  @Get('tenants/:tenantId/roles/:roleId')
  getTenantRole(
    @Param('tenantId', ParseIntPipe) tenantId: number,
    @Param('roleId', ParseIntPipe) roleId: number,
  ) {
    return this.rolesService.getTenantRole(tenantId, roleId);
  }

  @Post('tenants/:tenantId/roles')
  createTenantRole(
    @Param('tenantId', ParseIntPipe) tenantId: number,
    @Body() dto: CreateRoleDto,
  ) {
    return this.rolesService.createTenantRole(tenantId, dto);
  }

  @Patch('tenants/:tenantId/roles/:roleId')
  updateTenantRole(
    @Param('tenantId', ParseIntPipe) tenantId: number,
    @Param('roleId', ParseIntPipe) roleId: number,
    @Body() dto: UpdateRoleDto,
  ) {
    return this.rolesService.updateTenantRole(tenantId, roleId, dto);
  }

  @Delete('tenants/:tenantId/roles/:roleId')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeTenantRole(
    @Param('tenantId', ParseIntPipe) tenantId: number,
    @Param('roleId', ParseIntPipe) roleId: number,
  ) {
    return this.rolesService.removeTenantRole(tenantId, roleId);
  }
}
