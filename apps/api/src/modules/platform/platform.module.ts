import { Module } from '@nestjs/common';
import { TenantModule } from '../tenants/tenant.module';
import PaymentsModule from '../payments/payments.module';
import { CurrencyRequestsModule } from '../currency-requests/currency-requests.module';
import { PlatformTenantsController } from './tenants/tenants.controller';
import { PlatformTenantsService } from './tenants/tenants.service';
import { PlatformPaymentsController } from './payments/platform-payments.controller';
import { PlatformPaymentsService } from './payments/platform-payments.service';
import { PlatformCurrencyRequestsController } from './currency-requests/currency-requests.controller';

@Module({
  imports: [TenantModule, PaymentsModule, CurrencyRequestsModule],
  controllers: [
    PlatformTenantsController,
    PlatformPaymentsController,
    PlatformCurrencyRequestsController,
  ],
  providers: [PlatformTenantsService, PlatformPaymentsService],
})
export class PlatformModule {}
