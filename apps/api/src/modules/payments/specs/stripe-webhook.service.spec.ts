import { BadRequestException, type RawBodyRequest } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import type { IENV } from 'src/common/config/env.interface';
import { BillingInterval } from '../../subscriptions/constants/billing-interval.enum';
import type { OrderPaymentService } from '../services/order-payment.service';
import type { SubscriptionPaymentService } from '../services/subscription-payment.service';
import type { StripeClientService } from '../stripe/stripe-client.service';
import { StripeWebhookService } from '../webhooks/stripe-webhook.service';

const RAW_BODY = Buffer.from('{}');
const WEBHOOK_SECRET = 'whsec_test';
const ORDER_METADATA = {
  orderId: 1,
  userId: 7,
  tenant: 'tenant_acme',
};
const SUBSCRIPTION_METADATA = {
  kind: 'subscription' as const,
  subscriptionId: 11,
  tenantId: 3,
  planId: 2,
  billingInterval: BillingInterval.MONTHLY,
  tenant: 'tenant_acme',
};

const webhookRequest = (rawBody?: Buffer) =>
  ({ rawBody }) as RawBodyRequest<Request>;

const buildMocks = () => {
  const stripe = {
    webhooks: { constructEvent: jest.fn() },
    paymentIntents: { retrieve: jest.fn() },
    charges: { retrieve: jest.fn() },
  };
  const config = {
    getOrThrow: jest.fn().mockReturnValue({ webhookSecret: WEBHOOK_SECRET }),
  };
  const stripeClient = { client: stripe };
  const orderPayments = {
    successOrderPayment: jest.fn(),
    cancelOrderPayment: jest.fn(),
    failedOrderPayment: jest.fn(),
    refundedOrderPayment: jest.fn(),
  };
  const subscriptionPayments = {
    successSubscriptionPayment: jest.fn(),
    cancelSubscriptionPayment: jest.fn(),
    failedSubscriptionPayment: jest.fn(),
    refundedSubscriptionPayment: jest.fn(),
  };
  const service = new StripeWebhookService(
    config as unknown as ConfigService<IENV>,
    stripeClient as unknown as StripeClientService,
    orderPayments as unknown as OrderPaymentService,
    subscriptionPayments as unknown as SubscriptionPaymentService,
  );

  return {
    service,
    config,
    stripe,
    orderPayments,
    subscriptionPayments,
  };
};

const dispatch = (
  stripe: ReturnType<typeof buildMocks>['stripe'],
  type: string,
  object: Record<string, unknown>,
) => {
  stripe.webhooks.constructEvent.mockReturnValue({
    type,
    data: { object },
  });
};

const paymentIntent = (
  metadata: Record<string, unknown> = ORDER_METADATA,
  overrides: Record<string, unknown> = {},
) => ({
  id: 'pi_1',
  metadata: { data: JSON.stringify(metadata) },
  latest_charge: { amount_refunded: 100 },
  ...overrides,
});

const expectNoHandlers = (
  orderPayments: ReturnType<typeof buildMocks>['orderPayments'],
  subscriptionPayments: ReturnType<typeof buildMocks>['subscriptionPayments'],
) => {
  for (const handler of Object.values(orderPayments))
    expect(handler).not.toHaveBeenCalled();
  for (const handler of Object.values(subscriptionPayments))
    expect(handler).not.toHaveBeenCalled();
};

describe('StripeWebhookService', () => {
  describe('signature verification', () => {
    it('rejects a request without a raw body', async () => {
      const { service, config, stripe } = buildMocks();

      await expect(
        service.webHook(webhookRequest(), 'sig'),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(config.getOrThrow).not.toHaveBeenCalled();
      expect(stripe.webhooks.constructEvent).not.toHaveBeenCalled();
    });

    it('rejects an invalid signature', async () => {
      const { service, stripe } = buildMocks();
      stripe.webhooks.constructEvent.mockImplementation(() => {
        throw new Error('bad signature');
      });

      await expect(
        service.webHook(webhookRequest(RAW_BODY), 'sig'),
      ).rejects.toThrow('Invalid webhook signature');
    });

    it('constructs the event from the raw body, signature, and configured secret', async () => {
      const { service, config, stripe } = buildMocks();
      dispatch(stripe, 'customer.created', { id: 'cus_1' });

      await service.webHook(webhookRequest(RAW_BODY), 'sig_test');

      expect(config.getOrThrow).toHaveBeenCalledWith('stripe');
      expect(stripe.webhooks.constructEvent).toHaveBeenCalledWith(
        RAW_BODY,
        'sig_test',
        WEBHOOK_SECRET,
      );
    });
  });

  describe('payment intent routing', () => {
    it.each([
      ['payment_intent.succeeded', 'successOrderPayment'],
      ['payment_intent.canceled', 'cancelOrderPayment'],
      ['payment_intent.payment_failed', 'failedOrderPayment'],
    ] as const)('routes %s to the order handler', async (type, handler) => {
      const { service, stripe, orderPayments, subscriptionPayments } =
        buildMocks();
      dispatch(stripe, type, paymentIntent());

      await service.webHook(webhookRequest(RAW_BODY), 'sig');

      expect(orderPayments[handler]).toHaveBeenCalledWith(
        ORDER_METADATA,
        'pi_1',
      );
      for (const subscriptionHandler of Object.values(subscriptionPayments))
        expect(subscriptionHandler).not.toHaveBeenCalled();
    });

    it('routes subscription success only to subscription reconciliation', async () => {
      const { service, stripe, orderPayments, subscriptionPayments } =
        buildMocks();
      dispatch(
        stripe,
        'payment_intent.succeeded',
        paymentIntent(SUBSCRIPTION_METADATA, { id: 'pi_sub_1' }),
      );

      await service.webHook(webhookRequest(RAW_BODY), 'sig');

      expect(
        subscriptionPayments.successSubscriptionPayment,
      ).toHaveBeenCalledWith(SUBSCRIPTION_METADATA, 'pi_sub_1');
      expect(orderPayments.successOrderPayment).not.toHaveBeenCalled();
    });

    it('routes subscription cancellation only to subscription reconciliation', async () => {
      const { service, stripe, orderPayments, subscriptionPayments } =
        buildMocks();
      dispatch(
        stripe,
        'payment_intent.canceled',
        paymentIntent(SUBSCRIPTION_METADATA, { id: 'pi_sub_1' }),
      );

      await service.webHook(webhookRequest(RAW_BODY), 'sig');

      expect(
        subscriptionPayments.cancelSubscriptionPayment,
      ).toHaveBeenCalledWith('pi_sub_1');
      expect(orderPayments.cancelOrderPayment).not.toHaveBeenCalled();
    });

    it('routes the subscription failure reason only to subscription reconciliation', async () => {
      const { service, stripe, orderPayments, subscriptionPayments } =
        buildMocks();
      dispatch(
        stripe,
        'payment_intent.payment_failed',
        paymentIntent(SUBSCRIPTION_METADATA, {
          id: 'pi_sub_1',
          last_payment_error: { message: 'declined' },
        }),
      );

      await service.webHook(webhookRequest(RAW_BODY), 'sig');

      expect(
        subscriptionPayments.failedSubscriptionPayment,
      ).toHaveBeenCalledWith('pi_sub_1', 'declined');
      expect(orderPayments.failedOrderPayment).not.toHaveBeenCalled();
    });

    it('ignores an intent event without metadata.data', async () => {
      const { service, stripe, orderPayments, subscriptionPayments } =
        buildMocks();
      dispatch(stripe, 'payment_intent.succeeded', {
        id: 'pi_1',
        metadata: {},
      });

      await service.webHook(webhookRequest(RAW_BODY), 'sig');

      expectNoHandlers(orderPayments, subscriptionPayments);
    });
  });

  describe('refund routing', () => {
    it('handles charge.refunded with a string payment_intent and expanded charge', async () => {
      const { service, stripe, orderPayments } = buildMocks();
      dispatch(stripe, 'charge.refunded', {
        id: 'ch_1',
        payment_intent: 'pi_1',
        refunds: { data: [{ id: 're_1' }] },
      });
      stripe.paymentIntents.retrieve.mockResolvedValue(
        paymentIntent(ORDER_METADATA, {
          latest_charge: { amount_refunded: 50 },
        }),
      );

      await service.webHook(webhookRequest(RAW_BODY), 'sig');

      expect(stripe.paymentIntents.retrieve).toHaveBeenCalledWith('pi_1', {
        expand: ['latest_charge'],
      });
      expect(orderPayments.refundedOrderPayment).toHaveBeenCalledWith(
        ORDER_METADATA,
        {
          paymentIntentId: 'pi_1',
          amountRefunded: 50,
          refundReference: 're_1',
        },
      );
    });

    it('handles charge.refunded with an expanded payment_intent', async () => {
      const { service, stripe, orderPayments } = buildMocks();
      dispatch(stripe, 'charge.refunded', {
        id: 'ch_1',
        payment_intent: { id: 'pi_2' },
        refunds: { data: [] },
      });
      stripe.paymentIntents.retrieve.mockResolvedValue(
        paymentIntent(ORDER_METADATA, {
          id: 'pi_2',
          latest_charge: { amount_refunded: 0 },
        }),
      );

      await service.webHook(webhookRequest(RAW_BODY), 'sig');

      expect(stripe.paymentIntents.retrieve).toHaveBeenCalledWith('pi_2', {
        expand: ['latest_charge'],
      });
      expect(orderPayments.refundedOrderPayment).toHaveBeenCalledWith(
        ORDER_METADATA,
        {
          paymentIntentId: 'pi_2',
          amountRefunded: 0,
          refundReference: null,
        },
      );
    });

    it('ignores charge.refunded without a payment_intent', async () => {
      const { service, stripe, orderPayments } = buildMocks();
      dispatch(stripe, 'charge.refunded', {
        id: 'ch_1',
        refunds: { data: [] },
      });

      await service.webHook(webhookRequest(RAW_BODY), 'sig');

      expect(stripe.paymentIntents.retrieve).not.toHaveBeenCalled();
      expect(orderPayments.refundedOrderPayment).not.toHaveBeenCalled();
    });

    it.each(['pending', 'requires_action'])(
      'skips refund lifecycle events with status %s',
      async (status) => {
        const { service, stripe, orderPayments } = buildMocks();
        dispatch(stripe, 'refund.updated', {
          id: 're_1',
          status,
          payment_intent: 'pi_1',
        });

        await service.webHook(webhookRequest(RAW_BODY), 'sig');

        expect(stripe.paymentIntents.retrieve).not.toHaveBeenCalled();
        expect(orderPayments.refundedOrderPayment).not.toHaveBeenCalled();
      },
    );

    it.each(['refund.created', 'refund.updated', 'charge.refund.updated'])(
      'reconciles a succeeded %s event using the refund id',
      async (type) => {
        const { service, stripe, orderPayments } = buildMocks();
        dispatch(stripe, type, {
          id: 're_9',
          status: 'succeeded',
          payment_intent: 'pi_1',
        });
        stripe.paymentIntents.retrieve.mockResolvedValue(paymentIntent());

        await service.webHook(webhookRequest(RAW_BODY), 'sig');

        expect(orderPayments.refundedOrderPayment).toHaveBeenCalledWith(
          ORDER_METADATA,
          expect.objectContaining({ refundReference: 're_9' }),
        );
      },
    );

    it('reconciles a failed refund with a null reference', async () => {
      const { service, stripe, orderPayments } = buildMocks();
      dispatch(stripe, 'refund.failed', {
        id: 're_9',
        status: 'failed',
        failure_reason: 'expired',
        payment_intent: 'pi_1',
      });
      stripe.paymentIntents.retrieve.mockResolvedValue(
        paymentIntent(ORDER_METADATA, {
          latest_charge: { amount_refunded: 0 },
        }),
      );

      await service.webHook(webhookRequest(RAW_BODY), 'sig');

      expect(orderPayments.refundedOrderPayment).toHaveBeenCalledWith(
        ORDER_METADATA,
        expect.objectContaining({ refundReference: null }),
      );
    });

    it('handles an expanded payment_intent on a refund event', async () => {
      const { service, stripe, orderPayments } = buildMocks();
      dispatch(stripe, 'refund.updated', {
        id: 're_2',
        status: 'succeeded',
        payment_intent: { id: 'pi_2' },
      });
      stripe.paymentIntents.retrieve.mockResolvedValue(
        paymentIntent(ORDER_METADATA, { id: 'pi_2' }),
      );

      await service.webHook(webhookRequest(RAW_BODY), 'sig');

      expect(stripe.paymentIntents.retrieve).toHaveBeenCalledWith('pi_2', {
        expand: ['latest_charge'],
      });
      expect(orderPayments.refundedOrderPayment).toHaveBeenCalled();
    });

    it('ignores a refund event without a payment_intent', async () => {
      const { service, stripe, orderPayments } = buildMocks();
      dispatch(stripe, 'refund.updated', {
        id: 're_1',
        status: 'succeeded',
      });

      await service.webHook(webhookRequest(RAW_BODY), 'sig');

      expect(stripe.paymentIntents.retrieve).not.toHaveBeenCalled();
      expect(orderPayments.refundedOrderPayment).not.toHaveBeenCalled();
    });

    it('retrieves a string latest_charge before reconciling', async () => {
      const { service, stripe, orderPayments } = buildMocks();
      dispatch(stripe, 'charge.refunded', {
        id: 'ch_1',
        payment_intent: 'pi_1',
        refunds: { data: [{ id: 're_1' }] },
      });
      stripe.paymentIntents.retrieve.mockResolvedValue(
        paymentIntent(ORDER_METADATA, { latest_charge: 'ch_1' }),
      );
      stripe.charges.retrieve.mockResolvedValue({ amount_refunded: 25 });

      await service.webHook(webhookRequest(RAW_BODY), 'sig');

      expect(stripe.charges.retrieve).toHaveBeenCalledWith('ch_1');
      expect(orderPayments.refundedOrderPayment).toHaveBeenCalledWith(
        ORDER_METADATA,
        expect.objectContaining({ amountRefunded: 25 }),
      );
    });

    it('ignores a refund when the retrieved intent has no metadata.data', async () => {
      const { service, stripe, orderPayments } = buildMocks();
      dispatch(stripe, 'charge.refunded', {
        id: 'ch_1',
        payment_intent: 'pi_1',
        refunds: { data: [] },
      });
      stripe.paymentIntents.retrieve.mockResolvedValue({
        id: 'pi_1',
        metadata: {},
        latest_charge: null,
      });

      await service.webHook(webhookRequest(RAW_BODY), 'sig');

      expect(orderPayments.refundedOrderPayment).not.toHaveBeenCalled();
      expect(stripe.charges.retrieve).not.toHaveBeenCalled();
    });

    it('ignores a refund when the retrieved intent has no charge', async () => {
      const { service, stripe, orderPayments } = buildMocks();
      dispatch(stripe, 'charge.refunded', {
        id: 'ch_1',
        payment_intent: 'pi_1',
        refunds: { data: [] },
      });
      stripe.paymentIntents.retrieve.mockResolvedValue(
        paymentIntent(ORDER_METADATA, { latest_charge: null }),
      );

      await service.webHook(webhookRequest(RAW_BODY), 'sig');

      expect(orderPayments.refundedOrderPayment).not.toHaveBeenCalled();
    });

    it('routes subscription refunds only to subscription reconciliation', async () => {
      const { service, stripe, orderPayments, subscriptionPayments } =
        buildMocks();
      dispatch(stripe, 'refund.created', {
        id: 're_sub_1',
        status: 'succeeded',
        payment_intent: 'pi_sub_1',
      });
      stripe.paymentIntents.retrieve.mockResolvedValue(
        paymentIntent(SUBSCRIPTION_METADATA, {
          id: 'pi_sub_1',
          latest_charge: { amount_refunded: 2900 },
        }),
      );

      await service.webHook(webhookRequest(RAW_BODY), 'sig');

      expect(
        subscriptionPayments.refundedSubscriptionPayment,
      ).toHaveBeenCalledWith('pi_sub_1', {
        amountRefunded: 2900,
        refundReference: 're_sub_1',
      });
      expect(orderPayments.refundedOrderPayment).not.toHaveBeenCalled();
    });
  });

  describe('ignored events', () => {
    it('ignores subscription and invoice events', async () => {
      const { service, stripe, orderPayments, subscriptionPayments } =
        buildMocks();

      for (const type of [
        'customer.subscription.created',
        'customer.subscription.updated',
        'customer.subscription.deleted',
        'invoice.paid',
        'invoice.payment_failed',
      ]) {
        dispatch(stripe, type, { id: 'ignored_1' });
        await service.webHook(webhookRequest(RAW_BODY), 'sig');
      }

      expectNoHandlers(orderPayments, subscriptionPayments);
      expect(stripe.paymentIntents.retrieve).not.toHaveBeenCalled();
    });

    it('ignores payment_intent.created and unknown events', async () => {
      const { service, stripe, orderPayments, subscriptionPayments } =
        buildMocks();

      dispatch(stripe, 'payment_intent.created', { id: 'pi_1' });
      await service.webHook(webhookRequest(RAW_BODY), 'sig');
      dispatch(stripe, 'customer.created', { id: 'cus_1' });
      await service.webHook(webhookRequest(RAW_BODY), 'sig');

      expectNoHandlers(orderPayments, subscriptionPayments);
      expect(stripe.paymentIntents.retrieve).not.toHaveBeenCalled();
    });
  });
});
