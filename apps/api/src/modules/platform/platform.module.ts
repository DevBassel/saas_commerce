import { Module } from '@nestjs/common';
import { TenantModule } from '../tenants/tenant.module';
import PaymentsModule from '../payments/payments.module';
import { PlatformTenantsController } from './tenants/tenants.controller';
import { PlatformTenantsService } from './tenants/tenants.service';
import { PlatformPaymentsController } from './payments/platform-payments.controller';
import { PlatformPaymentsService } from './payments/platform-payments.service';

@Module({
  imports: [TenantModule, PaymentsModule],
  controllers: [PlatformTenantsController, PlatformPaymentsController],
  providers: [PlatformTenantsService, PlatformPaymentsService],
})
export class PlatformModule {}
