import {
  Body,
  Controller,
  Get,
  NotFoundException,
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
import { presentUser } from './user.presenter';
import type { RequestWithUser } from '../auth/interfaces/RequestWithUser.interface';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('profile')
  async getProfile(@Req() request: RequestWithUser) {
    const user = await this.usersService.findOne(
      { id: request.user.id },
      { withPermissions: true },
    );
    if (!user) throw new NotFoundException();
    return presentUser(user);
  }

  @Get('profile/:id')
  @Permissions([UserPermissionKey.READ])
  async findOne(@Param('id', ParseIntPipe) id: number) {
    const user = await this.usersService.findOne(
      { id },
      { withPermissions: true, withRole: true },
    );
    return user ? presentUser(user) : null;
  }

  @Get()
  @Permissions([UserPermissionKey.READ])
  async findAll() {
    const users = await this.usersService.findAll();
    return users.map(presentUser);
  }

  @Patch(':id')
  @Permissions([UserPermissionKey.UPDATE])
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    const user = await this.usersService.update(id, updateUserDto);
    return user ? presentUser(user) : null;
  }

  @Delete(':id')
  @Permissions([UserPermissionKey.DELETE])
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.remove(id);
  }

  @Patch(':id/role')
  @Permissions([UserPermissionKey.ASSIGN_ROLE])
  async assignRole(
    @Param('id', ParseIntPipe) id: number,
    @Body() assignRoleDto: AssignRoleDto,
    @Req() request: RequestWithUser,
  ) {
    const user = await this.usersService.assignRole(
      id,
      assignRoleDto.roleId,
      request.user.role?.key ?? RoleKey.CUSTOMER,
    );
    return user ? presentUser(user) : null;
  }

  @Delete(':id/role')
  @Permissions([UserPermissionKey.ASSIGN_ROLE])
  async deassignRole(
    @Param('id', ParseIntPipe) id: number,
    @Req() request: RequestWithUser,
  ) {
    const user = await this.usersService.deassignRole(
      id,
      request.user.role?.key ?? RoleKey.CUSTOMER,
    );
    return user ? presentUser(user) : null;
  }

  @Post(':id/permissions')
  @Permissions([UserPermissionKey.ASSIGN_PERMISSIONS])
  async grantPermissions(
    @Param('id', ParseIntPipe) id: number,
    @Body() assignPermissionsDto: AssignPermissionsDto,
    @Req() request: RequestWithUser,
  ) {
    const user = await this.usersService.grantPermissions(
      id,
      assignPermissionsDto.permissionIds,
      request.user.role?.key ?? RoleKey.CUSTOMER,
      request.user.permissions,
    );
    return user ? presentUser(user) : null;
  }

  @Delete(':id/permissions')
  @Permissions([UserPermissionKey.ASSIGN_PERMISSIONS])
  async revokePermissions(
    @Param('id', ParseIntPipe) id: number,
    @Body() revokePermissionsDto: RevokePermissionsDto,
    @Req() request: RequestWithUser,
  ) {
    const user = await this.usersService.revokePermissions(
      id,
      revokePermissionsDto.permissionIds ?? [],
      request.user.role?.key ?? RoleKey.CUSTOMER,
    );
    return user ? presentUser(user) : null;
  }
}
