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
import { CreatePermissionDto } from '../../rbac/dto/create-permission.dto';
import { UpdatePermissionDto } from '../../rbac/dto/update-permission.dto';
import { PlatformPermissionsService } from './permissions.service';

@Platform()
@Controller('platform')
export class PlatformPermissionsController {
  constructor(
    private readonly permissionsService: PlatformPermissionsService,
  ) {}

  @Get('tenants/:tenantId/permissions')
  @Roles([RoleKey.SUPER_ADMIN])
  listTenantPermissions(@Param('tenantId', ParseIntPipe) tenantId: number) {
    return this.permissionsService.listTenantPermissions(tenantId);
  }

  @Post('tenants/:tenantId/permissions')
  @Roles([RoleKey.SUPER_ADMIN])
  createTenantPermission(
    @Param('tenantId', ParseIntPipe) tenantId: number,
    @Body() dto: CreatePermissionDto,
  ) {
    return this.permissionsService.createTenantPermission(tenantId, dto);
  }

  @Patch('tenants/:tenantId/permissions/:permissionId')
  @Roles([RoleKey.SUPER_ADMIN])
  updateTenantPermission(
    @Param('tenantId', ParseIntPipe) tenantId: number,
    @Param('permissionId', ParseIntPipe) permissionId: number,
    @Body() dto: UpdatePermissionDto,
  ) {
    return this.permissionsService.updateTenantPermission(
      tenantId,
      permissionId,
      dto,
    );
  }

  @Delete('tenants/:tenantId/permissions/:permissionId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles([RoleKey.SUPER_ADMIN])
  removeTenantPermission(
    @Param('tenantId', ParseIntPipe) tenantId: number,
    @Param('permissionId', ParseIntPipe) permissionId: number,
  ) {
    return this.permissionsService.removeTenantPermission(
      tenantId,
      permissionId,
    );
  }
}
