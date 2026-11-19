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
import { OrderPaymentService } from './stripe/services/order/order-payment.service';
import { SubscriptionPaymentService } from './stripe/services/subscription/subscription-payment.service';
import { StripeWebhookService } from './webhooks/stripe-webhook.service';
import { StripeConnectService } from './stripe/services/stripe-connect.service';
import { StripeWebhookEvent } from './entities/stripe-webhook-event.entity';
import { SubscriptionRefund } from './entities/subscription-refund.entity';
import { OrderPaymentStatusService } from './stripe/services/order/order-payment-status.service';
import { OrderPaymentIntentService } from './stripe/services/order/order-payment-intent.service';
import { OrderRefundService } from './stripe/services/order/order-refund.service';
import { SubscriptionPaymentStatusService } from './stripe/services/subscription/subscription-payment-status.service';
import { SubscriptionPaymentIntentService } from './stripe/services/subscription/subscription-payment-intent.service';
import { SubscriptionRefundService } from './stripe/services/subscription/subscription-refund.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Subscription,
      SubscriptionPayment,
      SubscriptionRefund,
      SubscriptionPlan,
      StripeWebhookEvent,
    ]),
    TenantModule,
    SubscriptionsModule,
  ],
  controllers: [PaymentsController, PlatformSubscriptionPaymentController],
  providers: [
    StripeClientService,
    OrderPaymentIntentService,
    OrderPaymentStatusService,
    OrderRefundService,
    OrderPaymentService,
    SubscriptionPaymentIntentService,
    SubscriptionPaymentStatusService,
    SubscriptionRefundService,
    SubscriptionPaymentService,
    StripeWebhookService,
    StripeConnectService,
    StripePaymentService,
  ],
  exports: [StripePaymentService],
})
export default class PaymentsModule {}
