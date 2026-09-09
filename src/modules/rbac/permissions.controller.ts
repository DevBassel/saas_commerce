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
import { RbacService } from './rbac.service';
import { CreatePermissionDto } from './dto/create-permission.dto';
import { UpdatePermissionDto } from './dto/update-permission.dto';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { RbacPermissionKey } from './constants/rbac-permissions.enum';

@Controller('permissions')
export class PermissionsController {
  constructor(private readonly rbacService: RbacService) {}

  @Get()
  @Permissions([RbacPermissionKey.PERMISSIONS_READ])
  findAll() {
    return this.rbacService.findAllPermissions();
  }

  @Post()
  @Permissions([RbacPermissionKey.PERMISSIONS_CREATE])
  create(@Body() dto: CreatePermissionDto) {
    return this.rbacService.createPermission(dto);
  }

  @Patch(':id')
  @Permissions([RbacPermissionKey.PERMISSIONS_UPDATE])
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePermissionDto,
  ) {
    return this.rbacService.updatePermission(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Permissions([RbacPermissionKey.PERMISSIONS_DELETE])
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.rbacService.removePermission(id);
  }
}
