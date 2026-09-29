import { Module } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { TenantModule } from '../tenants/tenant.module';
import PaymentsModule from '../payments/payments.module';

@Module({
  imports: [TenantModule, PaymentsModule],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
