import { Module } from '@nestjs/common';
import PaymentsController from './payments.controller';
import StripePaymentService from './stripe.payment.service';
import { TenantManagerService } from '../tenants/services/tenant-manager.service';
import PaymentService from './payments.service';

@Module({
  imports: [],
  controllers: [PaymentsController],
  providers: [StripePaymentService, TenantManagerService, PaymentService],
  exports: [StripePaymentService],
})
export default class PaymentsModule {}
