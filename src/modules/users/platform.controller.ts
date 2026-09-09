import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
import { UsersService } from './users.service';
import { Roles } from '../auth/decorators/role.decorator';
import { RoleKey } from '../../common/constants/RoleKey.enum';

@Controller('platform')
export class PlatformController {
  constructor(private readonly usersService: UsersService) {}

  @Get('stores')
  @Roles([RoleKey.SUPER_ADMIN])
  listStores() {
    return this.usersService.findAllStoreOwners();
  }

  @Get('stores/:id')
  @Roles([RoleKey.SUPER_ADMIN])
  getStore(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.findStoreOwnerById(id);
  }
}
