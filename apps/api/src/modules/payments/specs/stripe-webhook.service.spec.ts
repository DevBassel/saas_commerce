import { BadRequestException, type RawBodyRequest } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import type { IENV } from 'src/common/config/env.interface';
import type { DataSource, Repository } from 'typeorm';
import { BillingInterval } from '../../subscriptions/constants/billing-interval.enum';
import { StripeWebhookEventStatus } from '../constants/stripe-webhook-event-status.enum';
import { StripeWebhookEvent } from '../entities/stripe-webhook-event.entity';
import type { OrderPaymentService } from '../stripe/services/order/order-payment.service';
import type { SubscriptionPaymentService } from '../stripe/services/subscription/subscription-payment.service';
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
  const records = new Map<string, StripeWebhookEvent>();
  let pendingInsert: Partial<StripeWebhookEvent> | undefined;
  const transactionRepository = {
    findOneByOrFail: jest.fn(({ id }: { id: string }) => {
      const event = records.get(id);
      if (!event) throw new Error('event not found');
      return event;
    }),
    findOne: jest.fn(({ where }: { where: Record<string, unknown> }) => {
      if (typeof where.id === 'string') return records.get(where.id) ?? null;
      if (typeof where.resourceId === 'string') {
        const threshold = (
          where.stripeCreatedAt as { value?: Date } | undefined
        )?.value;
        return (
          [...records.values()].find(
            (event) =>
              event.resourceId === where.resourceId &&
              !!threshold &&
              event.stripeCreatedAt > threshold,
          ) ?? null
        );
      }
      return null;
    }),
    merge: jest.fn((target: object, source: object) =>
      Object.assign(target, source),
    ),
    save: jest.fn((event: StripeWebhookEvent) => {
      records.set(event.id, event);
      return event;
    }),
  };
  const manager = {
    getRepository: jest.fn(() => transactionRepository),
    query: jest.fn().mockResolvedValue(undefined),
  };
  let lockTail = Promise.resolve();
  const queryRunnerQuery = jest.fn();
  const createQueryRunner = jest.fn(() => {
    let releaseLock: (() => void) | undefined;
    let transactionSnapshot: Array<[string, StripeWebhookEvent]> | null = null;
    let transactionActive = false;
    return {
      manager,
      get isTransactionActive() {
        return transactionActive;
      },
      connect: jest.fn().mockResolvedValue(undefined),
      startTransaction: jest.fn(() => {
        transactionSnapshot = structuredClone([...records.entries()]);
        transactionActive = true;
        return Promise.resolve();
      }),
      commitTransaction: jest.fn(() => {
        transactionSnapshot = null;
        transactionActive = false;
        return Promise.resolve();
      }),
      rollbackTransaction: jest.fn(() => {
        records.clear();
        for (const [id, event] of transactionSnapshot ?? [])
          records.set(id, event);
        transactionSnapshot = null;
        transactionActive = false;
        return Promise.resolve();
      }),
      query: async (sql: string, parameters?: unknown[]): Promise<void> => {
        queryRunnerQuery(sql, parameters);
        if (sql.includes('pg_advisory_lock(')) {
          const previous = lockTail;
          lockTail = new Promise<void>((resolve) => {
            releaseLock = resolve;
          });
          await previous;
        } else if (sql.includes('pg_advisory_unlock(')) {
          releaseLock?.();
        }
      },
      release: jest.fn().mockResolvedValue(undefined),
    };
  });
  const dataSource = {
    createQueryRunner,
    transaction: jest.fn(
      async (callback: (value: typeof manager) => unknown) => {
        const snapshot = structuredClone([...records.entries()]);
        try {
          return await callback(manager);
        } catch (error) {
          records.clear();
          for (const [id, event] of snapshot) records.set(id, event);
          throw error;
        }
      },
    ),
  };
  interface TestInsertBuilder {
    insert: () => TestInsertBuilder;
    into: () => TestInsertBuilder;
    values: (values: Partial<StripeWebhookEvent>) => TestInsertBuilder;
    orIgnore: () => TestInsertBuilder;
    execute: () => Promise<Record<string, never>>;
  }
  const webhookEvents = {
    createQueryBuilder: jest.fn(() => {
      const builder: TestInsertBuilder = {
        insert: () => builder,
        into: () => builder,
        values: (values) => {
          pendingInsert = values;
          return builder;
        },
        orIgnore: () => builder,
        execute: () => {
          if (
            pendingInsert &&
            ![...records.values()].some(
              (event) => event.stripeEventId === pendingInsert?.stripeEventId,
            )
          ) {
            const now = new Date();
            const event = {
              id: `row_${records.size + 1}`,
              attempts: 0,
              processingStartedAt: null,
              processingToken: null,
              processedAt: null,
              failedAt: null,
              nextRetryAt: null,
              lastError: null,
              createdAt: now,
              updatedAt: now,
              ...pendingInsert,
            } as StripeWebhookEvent;
            records.set(event.id, event);
          }
          return Promise.resolve({});
        },
      };
      return builder;
    }),
    findOneBy: jest.fn(({ stripeEventId }: { stripeEventId: string }) =>
      [...records.values()].find(
        (event) => event.stripeEventId === stripeEventId,
      ),
    ),
    findOneByOrFail: jest.fn(({ id }: { id: string }) => {
      const event = records.get(id);
      if (!event) throw new Error('event not found');
      return event;
    }),
    find: jest.fn(() =>
      [...records.values()].filter(
        (event) => event.status !== StripeWebhookEventStatus.PROCESSED,
      ),
    ),
  };
  const service = new StripeWebhookService(
    config as unknown as ConfigService<IENV>,
    stripeClient as unknown as StripeClientService,
    orderPayments as unknown as OrderPaymentService,
    subscriptionPayments as unknown as SubscriptionPaymentService,
    webhookEvents as unknown as Repository<StripeWebhookEvent>,
    dataSource as unknown as DataSource,
  );

  return {
    service,
    config,
    stripe,
    orderPayments,
    subscriptionPayments,
    records,
    manager,
    queryRunner: { query: queryRunnerQuery },
    dataSource,
  };
};

let eventSequence = 0;

const dispatch = (
  stripe: ReturnType<typeof buildMocks>['stripe'],
  type: string,
  object: Record<string, unknown>,
  event: { id?: string; created?: number } = {},
) => {
  eventSequence += 1;
  stripe.webhooks.constructEvent.mockReturnValue({
    id: event.id ?? `evt_${eventSequence}`,
    created: event.created ?? eventSequence,
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

  describe('durable event processing', () => {
    it('stores and processes a Stripe event only once', async () => {
      const { service, stripe, orderPayments, records, dataSource } =
        buildMocks();
      dispatch(stripe, 'payment_intent.succeeded', paymentIntent(), {
        id: 'evt_duplicate',
        created: 100,
      });

      await service.webHook(webhookRequest(RAW_BODY), 'sig');
      await service.webHook(webhookRequest(RAW_BODY), 'sig');

      expect(orderPayments.successOrderPayment).toHaveBeenCalledTimes(1);
      expect(dataSource.transaction).toHaveBeenCalledTimes(2);
      expect([...records.values()]).toEqual([
        expect.objectContaining({
          stripeEventId: 'evt_duplicate',
          status: StripeWebhookEventStatus.PROCESSED,
          attempts: 1,
          processedAt: expect.any(Date) as Date,
        }),
      ]);
    });

    it('marks a failed event and retries the same event id', async () => {
      const { service, stripe, orderPayments, records } = buildMocks();
      orderPayments.successOrderPayment
        .mockRejectedValueOnce(new Error('temporary database failure'))
        .mockResolvedValueOnce(undefined);
      dispatch(stripe, 'payment_intent.succeeded', paymentIntent(), {
        id: 'evt_retry',
        created: 101,
      });

      await expect(
        service.webHook(webhookRequest(RAW_BODY), 'sig'),
      ).rejects.toThrow('temporary database failure');
      expect([...records.values()][0]).toEqual(
        expect.objectContaining({
          status: StripeWebhookEventStatus.FAILED,
          attempts: 1,
          lastError: 'temporary database failure',
          nextRetryAt: expect.any(Date) as Date,
        }),
      );

      await service.webHook(webhookRequest(RAW_BODY), 'sig');

      expect(orderPayments.successOrderPayment).toHaveBeenCalledTimes(2);
      expect([...records.values()][0]).toEqual(
        expect.objectContaining({
          status: StripeWebhookEventStatus.PROCESSED,
          attempts: 2,
          lastError: null,
        }),
      );
    });

    it('serializes older resource events for domain-level state guards', async () => {
      const { service, stripe, orderPayments, records, queryRunner } =
        buildMocks();
      dispatch(stripe, 'payment_intent.succeeded', paymentIntent(), {
        id: 'evt_newer',
        created: 200,
      });
      await service.webHook(webhookRequest(RAW_BODY), 'sig');

      dispatch(stripe, 'payment_intent.payment_failed', paymentIntent(), {
        id: 'evt_older',
        created: 100,
      });
      await service.webHook(webhookRequest(RAW_BODY), 'sig');

      expect(orderPayments.successOrderPayment).toHaveBeenCalledTimes(1);
      expect(orderPayments.failedOrderPayment).toHaveBeenCalledTimes(1);
      expect(queryRunner.query).toHaveBeenCalledTimes(4);
      expect(
        [...records.values()].find(
          (event) => event.stripeEventId === 'evt_older',
        ),
      ).toEqual(
        expect.objectContaining({
          status: StripeWebhookEventStatus.PROCESSED,
          attempts: 1,
        }),
      );
    });

    it('serializes refund hydration for the same payment intent', async () => {
      const { service, stripe, orderPayments } = buildMocks();
      stripe.webhooks.constructEvent
        .mockReturnValueOnce({
          id: 'evt_refund_1',
          created: 400,
          type: 'charge.refunded',
          data: {
            object: {
              id: 'ch_1',
              payment_intent: 'pi_1',
              refunds: { data: [{ id: 're_1' }] },
            },
          },
        })
        .mockReturnValueOnce({
          id: 'evt_refund_2',
          created: 401,
          type: 'charge.refunded',
          data: {
            object: {
              id: 'ch_1',
              payment_intent: 'pi_1',
              refunds: { data: [{ id: 're_2' }] },
            },
          },
        });
      stripe.paymentIntents.retrieve.mockResolvedValue(paymentIntent());

      let releaseFirst!: () => void;
      const firstCanFinish = new Promise<void>((resolve) => {
        releaseFirst = resolve;
      });
      let markFirstStarted!: () => void;
      const firstStarted = new Promise<void>((resolve) => {
        markFirstStarted = resolve;
      });
      orderPayments.refundedOrderPayment
        .mockImplementationOnce(async () => {
          markFirstStarted();
          await firstCanFinish;
        })
        .mockResolvedValueOnce(undefined);

      const first = service.webHook(webhookRequest(RAW_BODY), 'sig');
      await firstStarted;
      const second = service.webHook(webhookRequest(RAW_BODY), 'sig');
      await new Promise<void>((resolve) => setImmediate(resolve));

      expect(stripe.paymentIntents.retrieve).toHaveBeenCalledTimes(1);
      releaseFirst();
      await Promise.all([first, second]);
      expect(stripe.paymentIntents.retrieve).toHaveBeenCalledTimes(2);
      expect(orderPayments.refundedOrderPayment).toHaveBeenCalledTimes(2);
    });

    it('reconciles a due failed event from stored payload', async () => {
      const { service, stripe, orderPayments, records } = buildMocks();
      orderPayments.successOrderPayment.mockRejectedValueOnce(
        new Error('temporary database failure'),
      );
      dispatch(stripe, 'payment_intent.succeeded', paymentIntent(), {
        id: 'evt_reconcile',
        created: 300,
      });
      await expect(
        service.webHook(webhookRequest(RAW_BODY), 'sig'),
      ).rejects.toThrow('temporary database failure');
      const stored = [...records.values()][0];
      stored.nextRetryAt = new Date(0);

      await expect(service.reconcileEvents()).resolves.toEqual({
        attempted: 1,
        processed: 1,
        failed: 0,
      });
      expect(orderPayments.successOrderPayment).toHaveBeenCalledTimes(2);
      expect(stored.status).toBe(StripeWebhookEventStatus.PROCESSED);
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
      ).toHaveBeenCalledWith(
        SUBSCRIPTION_METADATA,
        'pi_sub_1',
        expect.anything(),
      );
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
      ).toHaveBeenCalledWith('pi_sub_1', expect.anything());
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
      ).toHaveBeenCalledWith('pi_sub_1', 'declined', expect.anything());
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
          providerStatus: 'succeeded',
          refundRecordId: null,
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
          providerStatus: 'succeeded',
          refundRecordId: null,
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
          metadata: { durable_refund_id: '42' },
        });
        stripe.paymentIntents.retrieve.mockResolvedValue(paymentIntent());

        await service.webHook(webhookRequest(RAW_BODY), 'sig');

        expect(orderPayments.refundedOrderPayment).toHaveBeenCalledWith(
          ORDER_METADATA,
          expect.objectContaining({
            refundReference: 're_9',
            refundRecordId: 42,
          }),
        );
      },
    );

    it('reconciles a failed refund with its exact refund reference', async () => {
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
        expect.objectContaining({ refundReference: 're_9' }),
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
      ).toHaveBeenCalledWith(
        'pi_sub_1',
        {
          amountRefunded: 2900,
          refundReference: 're_sub_1',
          providerStatus: 'succeeded',
          refundRecordId: null,
        },
        expect.anything(),
      );
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
