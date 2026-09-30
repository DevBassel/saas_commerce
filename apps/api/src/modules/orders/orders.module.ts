import { Module } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { ManageOrderService } from './manage-order.service';
import { OrdersController } from './orders.controller';
import { TenantModule } from '../tenants/tenant.module';
import PaymentsModule from '../payments/payments.module';

@Module({
  imports: [TenantModule, PaymentsModule],
  controllers: [OrdersController],
  providers: [OrdersService, ManageOrderService],
  exports: [OrdersService, ManageOrderService],
})
export class OrdersModule {}
