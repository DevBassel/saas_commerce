import {
  BadRequestException,
  Injectable,
  Logger,
  type RawBodyRequest,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import Stripe from 'stripe';
import { IENV, IStripe } from 'src/common/config/env.interface';
import {
  isSubscriptionPaymentMetaData,
  paymentMetaData,
  subscriptionPaymentMetaData,
} from '../constants/payment-metadata';
import { OrderPaymentService } from '../services/order-payment.service';
import { SubscriptionPaymentService } from '../services/subscription-payment.service';
import { StripeClientService } from '../stripe/stripe-client.service';

@Injectable()
export class StripeWebhookService {
  private readonly logger = new Logger('StripePaymentService');

  constructor(
    private readonly config: ConfigService<IENV>,
    private readonly stripeClient: StripeClientService,
    private readonly orderPayments: OrderPaymentService,
    private readonly subscriptionPayments: SubscriptionPaymentService,
  ) {}

  private get stripe(): Stripe {
    return this.stripeClient.client;
  }

  async webHook(req: RawBodyRequest<Request>, sig: string) {
    if (!req.rawBody) throw new BadRequestException('Raw body is required');
    let event: Stripe.Event;
    const { webhookSecret } = this.config.getOrThrow<IStripe>('stripe');
    try {
      event = this.stripe.webhooks.constructEvent(
        req.rawBody,
        sig,
        webhookSecret,
      );
    } catch (err) {
      this.logger.warn(
        `Stripe webhook signature verification failed: ${
          err instanceof Error ? err.message : 'unknown error'
        }`,
      );
      throw new BadRequestException('Invalid webhook signature');
    }

    switch (event.type) {
      case 'payment_intent.succeeded':
      case 'payment_intent.canceled':
      case 'payment_intent.payment_failed': {
        const intent = event.data.object;
        if (!intent.metadata?.data) {
          this.logger.warn(
            `Stripe ${event.type} for ${intent.id} has no metadata.data; ignoring`,
          );
          return;
        }
        const data = JSON.parse(intent.metadata.data) as
          paymentMetaData | subscriptionPaymentMetaData;
        if (isSubscriptionPaymentMetaData(data))
          return await this.handleSubscriptionEvents(event, intent, data);
        return await this.handleOrderPaymentEvents(event, intent, data);
      }

      case 'charge.refunded':
      case 'refund.created':
      case 'refund.updated':
      case 'refund.failed':
      case 'charge.refund.updated': {
        const context = this.resolveRefundContext(event);
        if (!context) return;

        const intent = await this.stripe.paymentIntents.retrieve(
          context.paymentIntentId,
          { expand: ['latest_charge'] },
        );
        if (!intent.metadata?.data) {
          this.logger.warn(
            `Stripe refund for ${context.paymentIntentId} has no metadata.data; ignoring`,
          );
          return;
        }
        const data = JSON.parse(intent.metadata.data) as
          paymentMetaData | subscriptionPaymentMetaData;
        if (isSubscriptionPaymentMetaData(data))
          return await this.handleSubscriptionEvents(
            event,
            intent,
            data,
            context.refundReference,
          );
        return await this.handleOrderPaymentEvents(
          event,
          intent,
          data,
          context.refundReference,
        );
      }

      default:
        this.logger.debug(`Unhandled event type ${event.type}`);
    }

    return;
  }

  private async handleOrderPaymentEvents(
    event: Stripe.Event,
    intent: Stripe.PaymentIntent,
    data: paymentMetaData,
    refundReference: string | null = null,
  ) {
    switch (event.type) {
      case 'payment_intent.succeeded':
        return await this.orderPayments.successOrderPayment(data, intent.id);
      case 'payment_intent.canceled':
        return await this.orderPayments.cancelOrderPayment(data, intent.id);
      case 'payment_intent.payment_failed':
        return await this.orderPayments.failedOrderPayment(data, intent.id);
      default: {
        const charge = await this.latestCharge(intent);
        if (!charge) {
          this.logger.warn(
            `Stripe refund for ${intent.id} has no charge; ignoring`,
          );
          return;
        }
        return await this.orderPayments.refundedOrderPayment(data, {
          paymentIntentId: intent.id,
          amountRefunded: charge.amount_refunded,
          refundReference,
        });
      }
    }
  }

  private async handleSubscriptionEvents(
    event: Stripe.Event,
    intent: Stripe.PaymentIntent,
    data: subscriptionPaymentMetaData,
    refundReference: string | null = null,
  ): Promise<void> {
    switch (event.type) {
      case 'payment_intent.succeeded':
        return await this.subscriptionPayments.successSubscriptionPayment(
          data,
          intent.id,
        );
      case 'payment_intent.canceled':
        return await this.subscriptionPayments.cancelSubscriptionPayment(
          intent.id,
        );
      case 'payment_intent.payment_failed':
        return await this.subscriptionPayments.failedSubscriptionPayment(
          intent.id,
          intent.last_payment_error?.message ?? null,
        );
      default: {
        const charge = await this.latestCharge(intent);
        if (!charge) {
          this.logger.warn(
            `Stripe refund for ${intent.id} has no charge; ignoring`,
          );
          return;
        }
        return await this.subscriptionPayments.refundedSubscriptionPayment(
          intent.id,
          {
            amountRefunded: charge.amount_refunded,
            refundReference,
          },
        );
      }
    }
  }

  private resolveRefundContext(
    event: Stripe.Event,
  ): { paymentIntentId: string; refundReference: string | null } | null {
    if (event.type === 'charge.refunded') {
      const charge = event.data.object;
      const paymentIntentId =
        typeof charge.payment_intent === 'string'
          ? charge.payment_intent
          : charge.payment_intent?.id;
      if (!paymentIntentId) {
        this.logger.warn(
          `Stripe ${event.type} for charge ${charge.id} has no payment_intent; ignoring`,
        );
        return null;
      }
      return {
        paymentIntentId,
        refundReference: charge.refunds?.data?.[0]?.id ?? null,
      };
    }

    const refund = event.data.object as Stripe.Refund;
    if (refund.status === 'pending' || refund.status === 'requires_action')
      return null;

    const paymentIntentId =
      typeof refund.payment_intent === 'string'
        ? refund.payment_intent
        : refund.payment_intent?.id;
    if (!paymentIntentId) {
      this.logger.warn(
        `Stripe ${event.type} for refund ${refund.id} has no payment_intent; ignoring`,
      );
      return null;
    }

    if (refund.status !== 'succeeded')
      this.logger.warn(
        `Stripe ${event.type} for refund ${refund.id} is ${refund.status}${
          refund.failure_reason ? ` (${refund.failure_reason})` : ''
        }`,
      );

    return {
      paymentIntentId,
      refundReference: refund.status === 'succeeded' ? refund.id : null,
    };
  }

  private async latestCharge(
    paymentIntent: Stripe.PaymentIntent,
  ): Promise<Stripe.Charge | null> {
    const charge = paymentIntent.latest_charge;
    if (!charge) return null;
    if (typeof charge === 'string')
      return await this.stripe.charges.retrieve(charge);
    return charge;
  }
}
