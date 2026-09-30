import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { TenantModule } from '../tenants/tenant.module';
import PaymentsModule from '../payments/payments.module';

@Module({
  imports: [TenantModule, PaymentsModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
