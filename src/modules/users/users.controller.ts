import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Param,
  Delete,
  ParseIntPipe,
  Req,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { AssignRoleDto } from './dto/assign-role.dto';
import { AssignPermissionsDto } from './dto/assign-permissions.dto';
import { RevokePermissionsDto } from './dto/revoke-permissions.dto';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { UserPermissionKey } from './constants/user-permissions.enum';
import { RoleKey } from '../../common/constants/RoleKey.enum';
import type { RequestWithUser } from '../auth/interfaces/RequestWithUser.interface';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('profile')
  getProfile(@Req() request: RequestWithUser) {
    return request.user;
  }

  @Get('profile/:id')
  @Permissions([UserPermissionKey.READ])
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.findOne(
      { id },
      { withPermissions: true, withRole: true },
    );
  }

  @Get()
  @Permissions([UserPermissionKey.READ])
  findAll() {
    return this.usersService.findAll();
  }

  @Patch(':id')
  @Permissions([UserPermissionKey.UPDATE])
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    return this.usersService.update(id, updateUserDto);
  }

  @Delete(':id')
  @Permissions([UserPermissionKey.DELETE])
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.remove(id);
  }

  @Patch(':id/role')
  @Permissions([UserPermissionKey.ASSIGN_ROLE])
  assignRole(
    @Param('id', ParseIntPipe) id: number,
    @Body() assignRoleDto: AssignRoleDto,
    @Req() request: RequestWithUser,
  ) {
    return this.usersService.assignRole(
      id,
      assignRoleDto.roleId,
      request.user.role?.key ?? RoleKey.CUSTOMER,
    );
  }

  @Delete(':id/role')
  @Permissions([UserPermissionKey.ASSIGN_ROLE])
  deassignRole(
    @Param('id', ParseIntPipe) id: number,
    @Req() request: RequestWithUser,
  ) {
    return this.usersService.deassignRole(
      id,
      request.user.role?.key ?? RoleKey.CUSTOMER,
    );
  }

  @Post(':id/permissions')
  @Permissions([UserPermissionKey.ASSIGN_PERMISSIONS])
  grantPermissions(
    @Param('id', ParseIntPipe) id: number,
    @Body() assignPermissionsDto: AssignPermissionsDto,
    @Req() request: RequestWithUser,
  ) {
    return this.usersService.grantPermissions(
      id,
      assignPermissionsDto.permissionIds,
      request.user.role?.key ?? RoleKey.CUSTOMER,
      request.user.permissions,
    );
  }

  @Delete(':id/permissions')
  @Permissions([UserPermissionKey.ASSIGN_PERMISSIONS])
  revokePermissions(
    @Param('id', ParseIntPipe) id: number,
    @Body() revokePermissionsDto: RevokePermissionsDto,
    @Req() request: RequestWithUser,
  ) {
    return this.usersService.revokePermissions(
      id,
      revokePermissionsDto.permissionIds ?? [],
      request.user.role?.key ?? RoleKey.CUSTOMER,
    );
  }
}
