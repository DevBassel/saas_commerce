import { Module } from '@nestjs/common';
import PaymentsController from './payments.controller';
import PlatformSubscriptionPaymentController from './platform-subscription-payment.controller';
import StripePaymentService from './stripe.payment.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Subscription } from './entities/subscription.entity';
import { SubscriptionPayment } from './entities/subscription-payment.entity';
import { SubscriptionPlan } from '../subscriptions/entities/subscription-plan.entity';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { TenantModule } from '../tenants/tenant.module';
import { StripeClientService } from './stripe/stripe-client.service';
import { OrderPaymentService } from './services/order-payment.service';
import { SubscriptionPaymentService } from './services/subscription-payment.service';
import { StripeWebhookService } from './webhooks/stripe-webhook.service';
import { StripeConnectService } from './services/stripe-connect.service';
import { StripeWebhookEvent } from './entities/stripe-webhook-event.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Subscription,
      SubscriptionPayment,
      SubscriptionPlan,
      StripeWebhookEvent,
    ]),
    TenantModule,
    SubscriptionsModule,
  ],
  controllers: [PaymentsController, PlatformSubscriptionPaymentController],
  providers: [
    StripeClientService,
    OrderPaymentService,
    SubscriptionPaymentService,
    StripeWebhookService,
    StripeConnectService,
    StripePaymentService,
  ],
  exports: [StripePaymentService],
})
export default class PaymentsModule {}
