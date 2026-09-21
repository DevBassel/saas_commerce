import { Module } from '@nestjs/common';
import { TenantModule } from '../tenants/tenant.module';
import { PlatformTenantsController } from './tenants/tenants.controller';
import { PlatformTenantsService } from './tenants/tenants.service';

@Module({
  imports: [TenantModule],
  controllers: [PlatformTenantsController],
  providers: [PlatformTenantsService],
})
export class PlatformModule {}
