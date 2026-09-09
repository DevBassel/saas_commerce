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
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { RbacPermissionKey } from './constants/rbac-permissions.enum';

@Controller('roles')
export class RolesController {
  constructor(private readonly rbacService: RbacService) {}

  @Get()
  @Permissions([RbacPermissionKey.ROLES_READ])
  findAll() {
    return this.rbacService.findAllRoles();
  }

  @Get(':id')
  @Permissions([RbacPermissionKey.ROLES_READ])
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.rbacService.findRoleById(id);
  }

  @Post()
  @Permissions([RbacPermissionKey.ROLES_CREATE])
  create(@Body() dto: CreateRoleDto) {
    return this.rbacService.createRole(dto);
  }

  @Patch(':id')
  @Permissions([RbacPermissionKey.ROLES_UPDATE])
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateRoleDto) {
    return this.rbacService.updateRole(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Permissions([RbacPermissionKey.ROLES_DELETE])
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.rbacService.removeRole(id);
  }
}
