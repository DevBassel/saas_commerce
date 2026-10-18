import { Module } from '@nestjs/common';
import PaymentsController from './payments.controller';
import PlatformSubscriptionPaymentController from './platform-subscription-payment.controller';
import StripePaymentService from './stripe.payment.service';
import { TenantManagerService } from '../tenants/services/tenant-manager.service';
import PaymentService from './payments.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Subscription } from './entities/subscription.entity';
import { SubscriptionPayment } from './entities/subscription-payment.entity';
import { SubscriptionPlan } from '../subscriptions/entities/subscription-plan.entity';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Subscription,
      SubscriptionPayment,
      SubscriptionPlan,
    ]),
    SubscriptionsModule,
  ],
  controllers: [PaymentsController, PlatformSubscriptionPaymentController],
  providers: [StripePaymentService, TenantManagerService, PaymentService],
  exports: [StripePaymentService],
})
export default class PaymentsModule {}
