import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { RbacModule } from '../rbac/rbac.module';
import { TenantModule } from '../tenants/tenant.module';
import { PlatformTenantRefService } from './common/tenant-ref.service';
import { PlatformTenantsController } from './tenants/tenants.controller';
import { PlatformTenantsService } from './tenants/tenants.service';
import { PlatformUsersController } from './users/users.controller';
import { PlatformUsersService } from './users/users.service';
import { PlatformRolesController } from './rbac/roles.controller';
import { PlatformRolesService } from './rbac/roles.service';
import { PlatformPermissionsController } from './rbac/permissions.controller';
import { PlatformPermissionsService } from './rbac/permissions.service';

@Module({
  imports: [UsersModule, RbacModule, TenantModule],
  controllers: [
    PlatformTenantsController,
    PlatformUsersController,
    PlatformRolesController,
    PlatformPermissionsController,
  ],
  providers: [
    PlatformTenantRefService,
    PlatformTenantsService,
    PlatformUsersService,
    PlatformRolesService,
    PlatformPermissionsService,
  ],
})
export class PlatformModule {}
