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
@Roles([RoleKey.SUPER_ADMIN])
@Controller('platform')
export class PlatformPermissionsController {
  constructor(
    private readonly permissionsService: PlatformPermissionsService,
  ) {}

  @Get('tenants/:tenantId/permissions')
  listTenantPermissions(@Param('tenantId', ParseIntPipe) tenantId: number) {
    return this.permissionsService.listTenantPermissions(tenantId);
  }

  @Post('tenants/:tenantId/permissions')
  createTenantPermission(
    @Param('tenantId', ParseIntPipe) tenantId: number,
    @Body() dto: CreatePermissionDto,
  ) {
    return this.permissionsService.createTenantPermission(tenantId, dto);
  }

  @Patch('tenants/:tenantId/permissions/:permissionId')
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
