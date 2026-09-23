import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { TenantModule } from '../tenants/tenant.module';

@Module({
  imports: [TenantModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
