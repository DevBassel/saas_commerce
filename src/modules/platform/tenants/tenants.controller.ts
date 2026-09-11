import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
import { Roles } from '../../auth/decorators/role.decorator';
import { Platform } from '../../auth/decorators/isPlatform.decorator';
import { RoleKey } from '../../../common/constants/RoleKey.enum';
import { PlatformTenantsService } from './tenants.service';

@Platform()
@Roles([RoleKey.SUPER_ADMIN])
@Controller('platform')
export class PlatformTenantsController {
  constructor(private readonly tenantsService: PlatformTenantsService) {}

  @Get('tenants')
  listTenants() {
    return this.tenantsService.listTenants();
  }

  @Get('tenants/:id')
  getTenant(@Param('id', ParseIntPipe) id: number) {
    return this.tenantsService.getTenant(id);
  }
}
