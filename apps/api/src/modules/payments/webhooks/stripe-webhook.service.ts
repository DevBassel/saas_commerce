import {
  BadRequestException,
  Injectable,
  Logger,
  type RawBodyRequest,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import type { Request } from 'express';
import Stripe from 'stripe';
import { IENV, IStripe } from 'src/common/config/env.interface';
import {
  DataSource,
  EntityManager,
  LessThan,
  LessThanOrEqual,
  QueryRunner,
  Repository,
} from 'typeorm';
import {
  isSubscriptionPaymentMetaData,
  paymentMetaData,
  subscriptionPaymentMetaData,
} from '../constants/payment-metadata';
import { StripeWebhookEventStatus } from '../constants/stripe-webhook-event-status.enum';
import { StripeWebhookEvent } from '../entities/stripe-webhook-event.entity';
import { OrderPaymentService } from '../services/order-payment.service';
import { SubscriptionPaymentService } from '../services/subscription-payment.service';
import { StripeClientService } from '../stripe/stripe-client.service';

const PROCESSING_TIMEOUT_MS = 5 * 60 * 1000;
const RETRY_BASE_DELAY_MS = 30 * 1000;
const RETRY_MAX_DELAY_MS = 60 * 60 * 1000;

interface PreparedStripeEvent {
  event: Stripe.Event;
  refund?: {
    context: { paymentIntentId: string; refundReference: string | null };
    intent: Stripe.PaymentIntent;
    charge: Stripe.Charge | null;
  } | null;
}

@Injectable()
export class StripeWebhookService {
  private readonly logger = new Logger('StripePaymentService');

  constructor(
    private readonly config: ConfigService<IENV>,
    private readonly stripeClient: StripeClientService,
    private readonly orderPayments: OrderPaymentService,
    private readonly subscriptionPayments: SubscriptionPaymentService,
    @InjectRepository(StripeWebhookEvent)
    private readonly webhookEvents: Repository<StripeWebhookEvent>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
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

    const stored = await this.storeEvent(event);
    await this.processStoredEvent(stored.id, true);
  }

  async reconcileEvents(limit = 100): Promise<{
    attempted: number;
    processed: number;
    failed: number;
  }> {
    const now = new Date();
    const staleBefore = new Date(now.getTime() - PROCESSING_TIMEOUT_MS);
    const events = await this.webhookEvents.find({
      where: [
        { status: StripeWebhookEventStatus.PENDING },
        {
          status: StripeWebhookEventStatus.FAILED,
          nextRetryAt: LessThanOrEqual(now),
        },
        {
          status: StripeWebhookEventStatus.PROCESSING,
          processingStartedAt: LessThan(staleBefore),
        },
      ],
      order: { stripeCreatedAt: 'ASC', createdAt: 'ASC' },
      take: Math.max(1, Math.min(limit, 1000)),
    });

    let processed = 0;
    let failed = 0;
    for (const event of events) {
      try {
        if (await this.processStoredEvent(event.id, false)) processed += 1;
      } catch (error) {
        failed += 1;
        this.logger.error(
          `Stripe webhook reconciliation failed for ${event.stripeEventId}: ${this.errorMessage(error)}`,
        );
      }
    }

    return { attempted: events.length, processed, failed };
  }

  private async dispatchEvent(
    prepared: PreparedStripeEvent,
    manager: EntityManager,
  ): Promise<void> {
    const { event } = prepared;
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
          return await this.handleSubscriptionEvents(
            event,
            intent,
            data,
            null,
            manager,
          );
        await this.handleOrderPaymentEvents(event, intent, data);
        return;
      }

      case 'charge.refunded':
      case 'refund.created':
      case 'refund.updated':
      case 'refund.failed':
      case 'charge.refund.updated': {
        if (!prepared.refund) return;
        const { charge, context, intent } = prepared.refund;
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
            manager,
            charge,
          );
        await this.handleOrderPaymentEvents(
          event,
          intent,
          data,
          context.refundReference,
          charge,
        );
        return;
      }

      default:
        this.logger.debug(`Unhandled event type ${event.type}`);
    }

    return;
  }

  private async storeEvent(event: Stripe.Event): Promise<StripeWebhookEvent> {
    await this.webhookEvents
      .createQueryBuilder()
      .insert()
      .into(StripeWebhookEvent)
      .values({
        stripeEventId: event.id,
        eventType: event.type,
        resourceId: this.resolveResourceId(event),
        stripeCreatedAt: new Date(event.created * 1000),
        payload: event as never,
        status: StripeWebhookEventStatus.PENDING,
      })
      .orIgnore()
      .execute();

    const stored = await this.webhookEvents.findOneBy({
      stripeEventId: event.id,
    });
    if (!stored)
      throw new Error(`Stripe webhook event ${event.id} could not be stored`);
    return stored;
  }

  private async processStoredEvent(
    id: string,
    ignoreRetryAt: boolean,
  ): Promise<boolean> {
    const processingToken = randomUUID();
    let queryRunner: QueryRunner | null = null;
    let advisoryKey: string | null = null;
    try {
      const claimed = await this.claimEvent(id, processingToken, ignoreRetryAt);
      if (!claimed) return false;

      advisoryKey = `stripe-webhook:${
        claimed.resourceId ?? claimed.stripeEventId
      }`;
      queryRunner = this.dataSource.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.query('SELECT pg_advisory_lock(hashtext($1))', [
        advisoryKey,
      ]);
      const prepared = await this.prepareEvent(claimed.payload);
      await queryRunner.startTransaction();
      try {
        const events = queryRunner.manager.getRepository(StripeWebhookEvent);
        const event = await events.findOne({
          where: { id },
          lock: { mode: 'pessimistic_write' },
        });
        if (
          !event ||
          event.status !== StripeWebhookEventStatus.PROCESSING ||
          event.processingToken !== processingToken
        ) {
          await queryRunner.commitTransaction();
          return false;
        }

        await this.dispatchEvent(prepared, queryRunner.manager);

        events.merge(event, {
          status: StripeWebhookEventStatus.PROCESSED,
          processedAt: new Date(),
          processingStartedAt: null,
          processingToken: null,
        });
        await events.save(event);
        await queryRunner.commitTransaction();
        return true;
      } catch (error) {
        if (queryRunner.isTransactionActive)
          await queryRunner.rollbackTransaction();
        throw error;
      }
    } catch (error) {
      if (queryRunner) {
        await this.releaseResourceLock(queryRunner, advisoryKey);
        queryRunner = null;
      }
      await this.markFailed(id, processingToken, error);
      throw error;
    } finally {
      if (queryRunner) await this.releaseResourceLock(queryRunner, advisoryKey);
    }
  }

  private async releaseResourceLock(
    queryRunner: QueryRunner,
    advisoryKey: string | null,
  ): Promise<void> {
    if (advisoryKey) {
      try {
        await queryRunner.query('SELECT pg_advisory_unlock(hashtext($1))', [
          advisoryKey,
        ]);
      } catch (error) {
        this.logger.warn(
          `Stripe webhook advisory unlock failed: ${this.errorMessage(error)}`,
        );
        await queryRunner
          .query('SELECT pg_advisory_unlock_all()')
          .catch(() => undefined);
      }
    }
    await queryRunner.release();
  }

  private async claimEvent(
    id: string,
    processingToken: string,
    ignoreRetryAt: boolean,
  ): Promise<StripeWebhookEvent | null> {
    return this.dataSource.transaction(async (manager) => {
      const events = manager.getRepository(StripeWebhookEvent);
      const event = await events.findOne({
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!event || event.status === StripeWebhookEventStatus.PROCESSED)
        return null;

      const now = new Date();
      if (
        event.status === StripeWebhookEventStatus.PROCESSING &&
        event.processingStartedAt &&
        event.processingStartedAt.getTime() >
          now.getTime() - PROCESSING_TIMEOUT_MS
      )
        return null;
      if (
        !ignoreRetryAt &&
        event.status === StripeWebhookEventStatus.FAILED &&
        event.nextRetryAt &&
        event.nextRetryAt > now
      )
        return null;

      events.merge(event, {
        status: StripeWebhookEventStatus.PROCESSING,
        attempts: event.attempts + 1,
        processingStartedAt: now,
        processingToken,
        failedAt: null,
        nextRetryAt: null,
        lastError: null,
      });
      await events.save(event);
      return event;
    });
  }

  private async markFailed(
    id: string,
    processingToken: string,
    error: unknown,
  ): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const events = manager.getRepository(StripeWebhookEvent);
      const event = await events.findOne({
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (
        !event ||
        event.status === StripeWebhookEventStatus.PROCESSED ||
        event.processingToken !== processingToken
      )
        return;

      const attempts = Math.max(1, event.attempts);
      const delay = Math.min(
        RETRY_BASE_DELAY_MS * 2 ** Math.max(0, attempts - 1),
        RETRY_MAX_DELAY_MS,
      );
      const failedAt = new Date();
      events.merge(event, {
        status: StripeWebhookEventStatus.FAILED,
        attempts,
        processingStartedAt: null,
        processingToken: null,
        failedAt,
        nextRetryAt: new Date(failedAt.getTime() + delay),
        lastError: this.errorMessage(error).slice(0, 4000),
      });
      await events.save(event);
    });
  }

  private resolveResourceId(event: Stripe.Event): string | null {
    const object = event.data.object as {
      id?: string;
      payment_intent?: string | { id?: string } | null;
    };
    if (event.type.startsWith('payment_intent.')) return object.id ?? null;
    if (event.type === 'charge.refunded' || event.type.includes('refund')) {
      if (typeof object.payment_intent === 'string')
        return object.payment_intent;
      return object.payment_intent?.id ?? object.id ?? null;
    }
    return object.id ?? null;
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }

  private async prepareEvent(
    event: Stripe.Event,
  ): Promise<PreparedStripeEvent> {
    if (
      event.type !== 'charge.refunded' &&
      event.type !== 'refund.created' &&
      event.type !== 'refund.updated' &&
      event.type !== 'refund.failed' &&
      event.type !== 'charge.refund.updated'
    )
      return { event };

    const context = this.resolveRefundContext(event);
    if (!context) return { event, refund: null };
    const intent = await this.stripe.paymentIntents.retrieve(
      context.paymentIntentId,
      { expand: ['latest_charge'] },
    );
    const charge = intent.metadata?.data
      ? await this.latestCharge(intent)
      : null;
    return { event, refund: { context, intent, charge } };
  }

  private async handleOrderPaymentEvents(
    event: Stripe.Event,
    intent: Stripe.PaymentIntent,
    data: paymentMetaData,
    refundReference: string | null = null,
    refundCharge?: Stripe.Charge | null,
  ) {
    switch (event.type) {
      case 'payment_intent.succeeded':
        return await this.orderPayments.successOrderPayment(data, intent.id);
      case 'payment_intent.canceled':
        return await this.orderPayments.cancelOrderPayment(data, intent.id);
      case 'payment_intent.payment_failed':
        return await this.orderPayments.failedOrderPayment(data, intent.id);
      default: {
        const charge =
          refundCharge === undefined
            ? await this.latestCharge(intent)
            : refundCharge;
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
    manager?: EntityManager,
    refundCharge?: Stripe.Charge | null,
  ): Promise<void> {
    switch (event.type) {
      case 'payment_intent.succeeded':
        return await this.subscriptionPayments.successSubscriptionPayment(
          data,
          intent.id,
          manager,
        );
      case 'payment_intent.canceled':
        return await this.subscriptionPayments.cancelSubscriptionPayment(
          intent.id,
          manager,
        );
      case 'payment_intent.payment_failed':
        return await this.subscriptionPayments.failedSubscriptionPayment(
          intent.id,
          intent.last_payment_error?.message ?? null,
          manager,
        );
      default: {
        const charge =
          refundCharge === undefined
            ? await this.latestCharge(intent)
            : refundCharge;
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
          manager,
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
