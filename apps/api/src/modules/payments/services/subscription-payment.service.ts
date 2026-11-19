import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import Stripe from 'stripe';
import { EntityManager, Repository } from 'typeorm';
import { toMajorUnit, toMinorUnit } from 'src/common/utils/money';
import { getTenantContext } from '../../auth/tenant-context';
import { BillingInterval } from '../../subscriptions/constants/billing-interval.enum';
import {
  FREE_PLAN_SLUG,
  SUBSCRIPTION_REFUND_WINDOW_DAYS,
} from '../../subscriptions/constants/subscription.constants';
import { SubscriptionPlan } from '../../subscriptions/entities/subscription-plan.entity';
import { SubscriptionService } from '../../subscriptions/services/subscription.service';
import { subscriptionPaymentMetaData } from '../constants/payment-metadata';
import { PaymentStatus } from '../constants/payment-status.enum';
import { PaymentsProviders } from '../constants/payments-providers';
import { CreateSubDto } from '../dto/create-sub.dto';
import { SubscriptionPayment } from '../entities/subscription-payment.entity';
import { Subscription } from '../entities/subscription.entity';
import { StripeClientService } from '../stripe/stripe-client.service';

@Injectable()
export class SubscriptionPaymentService {
  private readonly logger = new Logger('StripePaymentService');

  constructor(
    private readonly stripeClient: StripeClientService,
    @InjectRepository(SubscriptionPlan)
    private readonly plansRepo: Repository<SubscriptionPlan>,
    @InjectRepository(Subscription)
    private readonly subscriptionRepo: Repository<Subscription>,
    @InjectRepository(SubscriptionPayment)
    private readonly subscriptionPaymentRepo: Repository<SubscriptionPayment>,
    private readonly subscriptions: SubscriptionService,
  ) {}

  private get stripe(): Stripe {
    return this.stripeClient.client;
  }

  async createSubscriptionPaymentIntent(createSubDto: CreateSubDto) {
    const tenant = getTenantContext()?.tenant;

    if (!tenant) throw new ForbiddenException('Tenant context is required');

    const plan = await this.plansRepo.findOneBy({
      id: createSubDto.planId,
    });

    if (!plan)
      throw new NotFoundException(`Plan ${createSubDto.planId} not found`);

    if (!plan.active)
      throw new BadRequestException({
        code: 'PLAN_INACTIVE',
        message: 'Plan is inactive',
      });

    if (!plan.isPublic)
      throw new BadRequestException({
        code: 'PLAN_NOT_PUBLIC',
        message: 'Plan is not available for purchase',
      });

    const billingInterval =
      createSubDto.billingInterval ?? BillingInterval.MONTHLY;

    const amount =
      billingInterval === BillingInterval.YEARLY
        ? plan.yearlyPrice
        : plan.monthlyPrice;

    if (amount <= 0)
      throw new BadRequestException({
        code: 'PLAN_NOT_PURCHASABLE',
        message: 'Plan has no price for the selected interval',
      });

    const minorAmount = toMinorUnit(amount);

    if (minorAmount <= 0)
      throw new BadRequestException('Invalid subscription amount');

    const subscription = await this.subscriptionRepo.findOneBy({
      tenantId: tenant.id,
    });

    if (!subscription)
      throw new NotFoundException({
        code: 'SUBSCRIPTION_NOT_FOUND',
        message: 'Subscription not found',
      });

    const metadata: subscriptionPaymentMetaData = {
      kind: 'subscription',
      tenantId: tenant.id,
      planId: plan.id,
      billingInterval,
      tenant: tenant.schemaName,
      subscriptionId: subscription.id,
    };

    return this.subscriptionRepo.manager.transaction(async (manager) => {
      // 1. Lock subscription to prevent concurrent payment attempts.
      const subscription = await manager.findOne(Subscription, {
        where: { tenantId: tenant.id },
        lock: { mode: 'pessimistic_write' },
      });

      if (!subscription)
        throw new NotFoundException({
          code: 'SUBSCRIPTION_NOT_FOUND',
          message: 'Subscription not found',
        });

      // 2. Find latest Stripe payment attempt.
      const existingPayment = await manager.findOne(SubscriptionPayment, {
        where: {
          subscriptionId: subscription.id,
          provider: PaymentsProviders.STRIPE,
        },
        order: {
          createdAt: 'DESC',
        },
      });

      if (existingPayment?.paymentRef) {
        const existingIntent = await this.stripe.paymentIntents.retrieve(
          existingPayment.paymentRef,
        );

        if (existingIntent.status === 'succeeded')
          throw new ConflictException(
            'Subscription payment has already been completed',
          );

        if (
          [
            'requires_payment_method',
            'requires_confirmation',
            'requires_action',
            'processing',
          ].includes(existingIntent.status)
        ) {
          return {
            clientSecret: existingIntent.client_secret,
          };
        }

        if (existingIntent.status === 'canceled')
          throw new ConflictException(
            'Previous subscription payment attempt was canceled. A new payment attempt is required.',
          );
      }

      // 3. Create PaymentIntent with idempotency key.
      let intent: Stripe.PaymentIntent;

      try {
        intent = await this.stripe.paymentIntents.create(
          {
            amount: minorAmount,
            currency: plan.currency,
            payment_method_types: ['card'],
            metadata: {
              data: JSON.stringify({
                ...metadata,
                subscriptionId: subscription.id,
              }),
            },
          },
          {
            idempotencyKey:
              `tenant:${tenant.id}:subscription:${subscription.id}:` +
              `plan:${plan.id}:${billingInterval}:payment:v1`,
          },
        );
      } catch (error) {
        if (error instanceof Stripe.errors.StripeInvalidRequestError) {
          this.logger.warn(
            `Stripe subscription intent create failed: ${
              error.code ?? error.message
            }`,
          );

          throw new BadRequestException(
            'Subscription payment could not be started',
          );
        }

        throw error;
      }

      // 4. Save payment record.
      const payment = manager.create(SubscriptionPayment, {
        subscriptionId: subscription.id,
        planId: plan.id,
        billingInterval,
        provider: PaymentsProviders.STRIPE,
        status: PaymentStatus.PENDING,
        amount,
        currency: plan.currency,
        paymentRef: intent.id,
      });

      await manager.save(SubscriptionPayment, payment);

      return {
        clientSecret: intent.client_secret,
      };
    });
  }
  private async refundSubscriptionPayment(
    payment: SubscriptionPayment,
  ): Promise<void> {
    if (!payment.paymentRef) {
      throw new BadRequestException('Payment reference is missing');
    }

    let refund: Stripe.Refund;

    try {
      refund = await this.stripe.refunds.create(
        {
          payment_intent: payment.paymentRef,
        },
        {
          idempotencyKey: `refund-subscription-${payment.id}`,
        },
      );
    } catch (error) {
      if (error instanceof Stripe.errors.StripeInvalidRequestError) {
        this.logger.warn(
          `Stripe subscription refund failed for payment ${
            payment.id
          }: ${error.code ?? error.message}`,
        );

        throw new BadRequestException('Refund could not be processed');
      }

      throw error;
    }

    if (refund.status !== 'succeeded') {
      this.logger.warn(
        `Subscription refund ${refund.id} has status: ${refund.status}`,
      );

      return;
    }

    const refundedAt = new Date();

    await this.subscriptionPaymentRepo.manager.transaction(async (manager) => {
      const repository = manager.withRepository(this.subscriptionPaymentRepo);

      const currentPayment = await repository.findOne({
        where: { id: payment.id },
        lock: { mode: 'pessimistic_write' },
      });

      if (!currentPayment) {
        throw new NotFoundException(
          `Subscription payment ${payment.id} not found`,
        );
      }

      repository.merge(currentPayment, {
        status: PaymentStatus.REFUNDED,
        refundedAmount: toMajorUnit(refund.amount),
        refundReference: refund.id,
        refundedAt,
      });

      await repository.save(currentPayment);
    });
  }

  async cancelSubscriptionWithRefund(tenantId: number) {
    const subscription = await this.subscriptionRepo.findOneBy({ tenantId });
    if (!subscription)
      throw new NotFoundException({
        code: 'SUBSCRIPTION_NOT_FOUND',
        message: 'Subscription not found',
      });

    const payment = await this.subscriptionPaymentRepo.findOne({
      where: { subscriptionId: subscription.id, status: PaymentStatus.PAID },
      order: { id: 'DESC' },
    });

    if (payment?.paymentRef) await this.refundSubscriptionPayment(payment);

    await this.subscriptions.downgradeToFree(subscription.id);
    return this.subscriptionRepo.findOneBy({ id: subscription.id });
  }

  async cancelOwnSubscription(tenantId: number) {
    const subscription = await this.subscriptionRepo.findOneBy({ tenantId });
    if (!subscription)
      throw new NotFoundException({
        code: 'SUBSCRIPTION_NOT_FOUND',
        message: 'Subscription not found',
      });

    const latestPaid = await this.subscriptionPaymentRepo.findOne({
      where: { subscriptionId: subscription.id, status: PaymentStatus.PAID },
      order: { id: 'DESC' },
    });

    if (!latestPaid) {
      const alreadyRefunded = await this.subscriptionPaymentRepo.findOne({
        where: {
          subscriptionId: subscription.id,
          status: PaymentStatus.REFUNDED,
        },
        order: { id: 'DESC' },
      });
      if (!alreadyRefunded)
        throw new ConflictException({
          code: 'SUBSCRIPTION_NOT_REFUNDABLE',
          message: 'No paid subscription purchase to refund',
        });
      await this.subscriptions.downgradeToFree(subscription.id);
      return this.subscriptionRepo.findOneBy({ id: subscription.id });
    }

    const paidAt = latestPaid.paidAt ?? latestPaid.createdAt;
    const deadline = new Date(
      paidAt.getTime() + SUBSCRIPTION_REFUND_WINDOW_DAYS * 86_400_000,
    );
    if (Date.now() > deadline.getTime())
      throw new ConflictException({
        code: 'REFUND_WINDOW_EXPIRED',
        message: `Refund window closed on ${deadline.toISOString()}`,
      });

    await this.refundSubscriptionPayment(latestPaid);
    await this.subscriptions.downgradeToFree(subscription.id);
    return this.subscriptionRepo.findOneBy({ id: subscription.id });
  }

  async successSubscriptionPayment(
    meta: subscriptionPaymentMetaData,
    paymentRef: string,
    manager?: EntityManager,
  ) {
    const repository = manager
      ? manager.getRepository(SubscriptionPayment)
      : this.subscriptionPaymentRepo;
    const payment = await repository.findOne({
      where: { paymentRef },
      ...(manager ? { lock: { mode: 'pessimistic_write' as const } } : {}),
    });
    if (!payment)
      throw new NotFoundException(
        `Subscription payment ${paymentRef} not found`,
      );
    if (payment.planAppliedAt || payment.status === PaymentStatus.CANCELED)
      return;

    const assignment = {
      planId: meta.planId,
      billingInterval: meta.billingInterval,
    };
    if (manager)
      await this.subscriptions.assignPlan(meta.tenantId, assignment, manager);
    else await this.subscriptions.assignPlan(meta.tenantId, assignment);

    const planAppliedAt = new Date();
    const status =
      payment.status === PaymentStatus.REFUNDED ||
      payment.status === PaymentStatus.PARTIALLY_REFUNDED
        ? payment.status
        : PaymentStatus.PAID;
    await repository.update(
      { id: payment.id },
      {
        status,
        paidAt: payment.paidAt ?? planAppliedAt,
        planAppliedAt,
      },
    );

    if (status === PaymentStatus.REFUNDED) {
      await this.downgradeRefundedPlan(payment, repository, manager);
    }
  }

  async cancelSubscriptionPayment(paymentRef: string, manager?: EntityManager) {
    const repository = manager
      ? manager.getRepository(SubscriptionPayment)
      : this.subscriptionPaymentRepo;
    const payment = await repository.findOne({
      where: { paymentRef },
      ...(manager ? { lock: { mode: 'pessimistic_write' as const } } : {}),
    });
    if (!payment)
      throw new NotFoundException(
        `Subscription payment ${paymentRef} not found`,
      );
    if (
      payment.status === PaymentStatus.PAID ||
      payment.status === PaymentStatus.REFUNDED ||
      payment.status === PaymentStatus.PARTIALLY_REFUNDED
    )
      return;
    await repository.update(
      { id: payment.id },
      { status: PaymentStatus.CANCELED },
    );
  }

  async failedSubscriptionPayment(
    paymentRef: string,
    failureReason: string | null,
    manager?: EntityManager,
  ) {
    const repository = manager
      ? manager.getRepository(SubscriptionPayment)
      : this.subscriptionPaymentRepo;
    const payment = await repository.findOne({
      where: { paymentRef },
      ...(manager ? { lock: { mode: 'pessimistic_write' as const } } : {}),
    });
    if (!payment)
      throw new NotFoundException(
        `Subscription payment ${paymentRef} not found`,
      );
    if (
      payment.status === PaymentStatus.PAID ||
      payment.status === PaymentStatus.REFUNDED ||
      payment.status === PaymentStatus.PARTIALLY_REFUNDED ||
      payment.status === PaymentStatus.CANCELED
    )
      return;
    await repository.update(
      { id: payment.id },
      { status: PaymentStatus.FAILED, failureReason },
    );
  }

  async refundedSubscriptionPayment(
    paymentRef: string,
    refund: {
      amountRefunded: number;
      refundReference: string | null;
    },
    manager?: EntityManager,
  ) {
    const repository = manager
      ? manager.getRepository(SubscriptionPayment)
      : this.subscriptionPaymentRepo;
    const payment = await repository.findOne({
      where: { paymentRef },
      ...(manager ? { lock: { mode: 'pessimistic_write' as const } } : {}),
    });
    if (!payment)
      throw new NotFoundException(
        `Subscription payment ${paymentRef} not found`,
      );

    const refundedAmount = toMajorUnit(refund.amountRefunded);
    const total = Number(payment.amount);
    const status =
      refundedAmount <= 0
        ? PaymentStatus.PAID
        : refundedAmount >= total
          ? PaymentStatus.REFUNDED
          : PaymentStatus.PARTIALLY_REFUNDED;
    const refundedAt =
      refundedAmount > 0 ? (payment.refundedAt ?? new Date()) : null;

    await repository.update(
      { id: payment.id },
      {
        status,
        refundedAmount,
        refundReference:
          refund.refundReference ??
          (refundedAmount > 0 ? payment.refundReference : null),
        refundedAt,
      },
    );

    if (status === PaymentStatus.REFUNDED) {
      await this.downgradeRefundedPlan(payment, repository, manager);
      return;
    }

    if (payment.refundDowngradedAt) {
      const subscriptions = manager
        ? manager.getRepository(Subscription)
        : this.subscriptionRepo;
      const plans = manager
        ? manager.getRepository(SubscriptionPlan)
        : this.plansRepo;
      const subscription = manager
        ? await subscriptions.findOne({
            where: { id: payment.subscriptionId },
            lock: { mode: 'pessimistic_write' },
          })
        : await subscriptions.findOneBy({ id: payment.subscriptionId });
      const free = await plans.findOneBy({ slug: FREE_PLAN_SLUG });
      if (subscription && free && subscription.planId === free.id) {
        const assignment = {
          planId: payment.planId,
          billingInterval: payment.billingInterval,
        };
        if (manager)
          await this.subscriptions.assignPlan(
            subscription.tenantId,
            assignment,
            manager,
          );
        else
          await this.subscriptions.assignPlan(
            subscription.tenantId,
            assignment,
          );
      }
      await repository.update({ id: payment.id }, { refundDowngradedAt: null });
    }
  }

  private async downgradeRefundedPlan(
    payment: SubscriptionPayment,
    payments: Repository<SubscriptionPayment>,
    manager?: EntityManager,
  ): Promise<void> {
    const subscriptions = manager
      ? manager.getRepository(Subscription)
      : this.subscriptionRepo;
    const subscription = manager
      ? await subscriptions.findOne({
          where: { id: payment.subscriptionId },
          lock: { mode: 'pessimistic_write' },
        })
      : await subscriptions.findOneBy({ id: payment.subscriptionId });
    if (!subscription || subscription.planId !== payment.planId) return;

    if (manager)
      await this.subscriptions.downgradeToFree(payment.subscriptionId, manager);
    else await this.subscriptions.downgradeToFree(payment.subscriptionId);
    await payments.update(
      { id: payment.id },
      { refundDowngradedAt: new Date() },
    );
  }

  async downgradeSubscriptionToFree(subscriptionId: number) {
    return this.subscriptions.downgradeToFree(subscriptionId);
  }
}
