import {
  Body,
  Controller,
  Get,
  Patch,
  Param,
  Delete,
  ParseIntPipe,
  Req,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { AssignRoleDto } from './dto/assign-role.dto';
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
    return this.usersService.findOne({ id });
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

  @Delete(':id')
  @Permissions([UserPermissionKey.DELETE])
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.remove(id);
  }
}
