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
import { Repository } from 'typeorm';
import { toMajorUnit, toMinorUnit } from 'src/common/utils/money';
import { getTenantContext } from '../../auth/tenant-context';
import { BillingInterval } from '../../subscriptions/constants/billing-interval.enum';
import { SUBSCRIPTION_REFUND_WINDOW_DAYS } from '../../subscriptions/constants/subscription.constants';
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

    const plan = await this.plansRepo.findOneBy({ id: createSubDto.planId });
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
      subscriptionId: subscription.id,
      tenantId: tenant.id,
      planId: plan.id,
      billingInterval,
      tenant: tenant.schemaName,
    };

    let intent: Stripe.PaymentIntent;
    try {
      intent = await this.stripe.paymentIntents.create({
        amount: toMinorUnit(amount),
        currency: plan.currency,
        payment_method_types: ['card'],
        metadata: { data: JSON.stringify(metadata) },
      });
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

    await this.subscriptionPaymentRepo.save(
      this.subscriptionPaymentRepo.create({
        subscriptionId: subscription.id,
        planId: plan.id,
        billingInterval,
        provider: PaymentsProviders.STRIPE,
        status: PaymentStatus.PENDING,
        amount,
        currency: plan.currency,
        paymentRef: intent.id,
      }),
    );

    return { clientSecret: intent.client_secret };
  }

  private async refundSubscriptionPayment(
    payment: SubscriptionPayment,
  ): Promise<void> {
    if (!payment.paymentRef)
      throw new BadRequestException('Payment reference is missing');

    let refund: Stripe.Refund;
    try {
      refund = await this.stripe.refunds.create(
        { payment_intent: payment.paymentRef },
        { idempotencyKey: `refund-subscription-${payment.id}` },
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

    await this.subscriptionPaymentRepo.update(
      { id: payment.id },
      {
        status: PaymentStatus.REFUNDED,
        refundedAmount: payment.amount,
        refundReference: refund.id,
        refundedAt: new Date(),
      },
    );
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
  ) {
    const payment = await this.subscriptionPaymentRepo.findOne({
      where: { paymentRef },
    });
    if (!payment)
      throw new NotFoundException(
        `Subscription payment ${paymentRef} not found`,
      );
    if (payment.status === PaymentStatus.PAID) return;

    await this.subscriptions.assignPlan(meta.tenantId, {
      planId: meta.planId,
      billingInterval: meta.billingInterval,
    });

    await this.subscriptionPaymentRepo.update(
      { id: payment.id },
      { status: PaymentStatus.PAID, paidAt: new Date() },
    );
  }

  async cancelSubscriptionPayment(paymentRef: string) {
    const payment = await this.subscriptionPaymentRepo.findOne({
      where: { paymentRef },
    });
    if (!payment)
      throw new NotFoundException(
        `Subscription payment ${paymentRef} not found`,
      );
    await this.subscriptionPaymentRepo.update(
      { id: payment.id },
      { status: PaymentStatus.CANCELED },
    );
  }

  async failedSubscriptionPayment(
    paymentRef: string,
    failureReason: string | null,
  ) {
    const payment = await this.subscriptionPaymentRepo.findOne({
      where: { paymentRef },
    });
    if (!payment)
      throw new NotFoundException(
        `Subscription payment ${paymentRef} not found`,
      );
    await this.subscriptionPaymentRepo.update(
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
  ) {
    const payment = await this.subscriptionPaymentRepo.findOne({
      where: { paymentRef },
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

    await this.subscriptionPaymentRepo.update(
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
      await this.subscriptions.downgradeToFree(payment.subscriptionId);
    }
  }

  async downgradeSubscriptionToFree(subscriptionId: number) {
    return this.subscriptions.downgradeToFree(subscriptionId);
  }
}
