import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import Stripe from 'stripe';
import { EntityManager, Repository } from 'typeorm';
import { toMajorUnit } from 'src/common/utils/money';
import {
  FREE_PLAN_SLUG,
  SUBSCRIPTION_REFUND_WINDOW_DAYS,
} from '../../../../subscriptions/constants/subscription.constants';
import { SubscriptionPlan } from '../../../../subscriptions/entities/subscription-plan.entity';
import { SubscriptionService } from '../../../../subscriptions/services/subscription.service';
import { PaymentStatus } from '../../../constants/payment-status.enum';
import { RefundStatus } from '../../../constants/refund-status.enum';
import { SubscriptionPayment } from '../../../entities/subscription-payment.entity';
import { SubscriptionRefund } from '../../../entities/subscription-refund.entity';
import { Subscription } from '../../../entities/subscription.entity';
import { StripeClientService } from '../../stripe-client.service';
import { SubscriptionPaymentStatusService } from './subscription-payment-status.service';

const REFUND_RETRY_DELAY_MS = 30_000;

@Injectable()
export class SubscriptionRefundService {
  private readonly logger = new Logger('StripePaymentService');

  constructor(
    private readonly stripeClient: StripeClientService,
    @InjectRepository(SubscriptionPlan)
    private readonly plansRepo: Repository<SubscriptionPlan>,
    @InjectRepository(Subscription)
    private readonly subscriptionRepo: Repository<Subscription>,
    @InjectRepository(SubscriptionPayment)
    private readonly subscriptionPaymentRepo: Repository<SubscriptionPayment>,
    @InjectRepository(SubscriptionRefund)
    private readonly subscriptionRefundRepo: Repository<SubscriptionRefund>,
    private readonly subscriptions: SubscriptionService,
    private readonly paymentStatus: SubscriptionPaymentStatusService,
  ) {}

  private get stripe(): Stripe {
    return this.stripeClient.client;
  }

  private async refundSubscriptionPayment(
    payment: SubscriptionPayment,
  ): Promise<RefundStatus> {
    if (!payment.paymentRef) {
      throw new BadRequestException('Payment reference is missing');
    }

    const refundRecord = await this.subscriptionPaymentRepo.manager.transaction(
      async (manager) => {
        const payments = manager.withRepository(this.subscriptionPaymentRepo);
        const refunds = manager.withRepository(this.subscriptionRefundRepo);
        const currentPayment = await payments.findOne({
          where: { id: payment.id },
          lock: { mode: 'pessimistic_write' },
        });
        if (!currentPayment)
          throw new NotFoundException(
            `Subscription payment ${payment.id} not found`,
          );

        const existing = await refunds.findOne({
          where: { paymentId: payment.id },
          lock: { mode: 'pessimistic_write' },
        });
        if (existing) return existing;
        if (currentPayment.status !== PaymentStatus.PAID)
          throw new ConflictException('Subscription refund is already pending');

        const created = refunds.create({
          paymentId: currentPayment.id,
          subscriptionId: currentPayment.subscriptionId,
          amount: currentPayment.amount,
          currency: currentPayment.currency,
          idempotencyKey: `refund:subscription:${currentPayment.id}:v1`,
          status: RefundStatus.PENDING,
          attempts: 0,
        });
        const saved = await refunds.save(created);
        await payments.update(
          { id: currentPayment.id },
          { status: PaymentStatus.REFUND_PENDING },
        );
        return saved;
      },
    );

    if (refundRecord.status === RefundStatus.SUCCEEDED)
      return RefundStatus.SUCCEEDED;
    if (refundRecord.status === RefundStatus.FAILED)
      throw new BadRequestException('Refund could not be processed');
    return this.submitSubscriptionRefund(refundRecord);
  }

  async reconcileRefunds(
    limit = 100,
  ): Promise<{ attempted: number; processed: number; failed: number }> {
    const refunds = await this.subscriptionRefundRepo
      .createQueryBuilder('refund')
      .where('refund.status IN (:...statuses)', {
        statuses: [RefundStatus.PENDING, RefundStatus.PROCESSING],
      })
      .andWhere(
        '(refund."nextRetryAt" IS NULL OR refund."nextRetryAt" <= :now)',
        { now: new Date() },
      )
      .orderBy('refund.createdAt', 'ASC')
      .take(Math.max(1, Math.min(limit, 1000)))
      .getMany();

    let processed = 0;
    let failed = 0;
    for (const refund of refunds) {
      try {
        const status = await this.submitSubscriptionRefund(refund);
        if (status === RefundStatus.SUCCEEDED) processed += 1;
        if (status === RefundStatus.FAILED) failed += 1;
      } catch (error) {
        failed += 1;
        this.logger.error(
          `Subscription refund reconciliation failed for ${refund.id}: ${this.errorMessage(error)}`,
        );
      }
    }
    return { attempted: refunds.length, processed, failed };
  }

  private async submitSubscriptionRefund(
    refundRecord: SubscriptionRefund,
  ): Promise<RefundStatus> {
    const payment = await this.subscriptionPaymentRepo.findOneBy({
      id: refundRecord.paymentId,
    });
    if (!payment?.paymentRef)
      throw new BadRequestException('Payment reference is missing');

    await this.subscriptionRefundRepo.update(
      { id: refundRecord.id },
      {
        attempts: refundRecord.attempts + 1,
        lastError: null,
        nextRetryAt: null,
      },
    );

    let refund: Stripe.Refund;
    try {
      refund = refundRecord.providerRefundId
        ? await this.stripe.refunds.retrieve(refundRecord.providerRefundId)
        : await this.stripe.refunds.create(
            {
              payment_intent: payment.paymentRef,
              metadata: {
                durable_refund_id: String(refundRecord.id),
                durable_refund_kind: 'subscription',
              },
            },
            { idempotencyKey: refundRecord.idempotencyKey },
          );
    } catch (error) {
      const message = this.errorMessage(error);
      if (error instanceof Stripe.errors.StripeInvalidRequestError) {
        await this.failSubscriptionRefund(refundRecord.id, message);
        this.logger.warn(
          `Stripe subscription refund failed for payment ${
            payment.id
          }: ${error.code ?? error.message}`,
        );
        throw new BadRequestException('Refund could not be processed');
      }
      await this.subscriptionRefundRepo.update(
        { id: refundRecord.id },
        {
          status: RefundStatus.PENDING,
          lastError: message,
          nextRetryAt: new Date(Date.now() + REFUND_RETRY_DELAY_MS),
        },
      );
      return RefundStatus.PENDING;
    }

    const definitiveFailure =
      refund.status === 'failed' || refund.status === 'canceled';
    await this.subscriptionRefundRepo.update(
      { id: refundRecord.id },
      {
        providerRefundId: refund.id,
        providerStatus: refund.status,
        status: definitiveFailure
          ? RefundStatus.FAILED
          : RefundStatus.PROCESSING,
        lastError: refund.failure_reason ?? null,
        nextRetryAt:
          refund.status === 'succeeded' || definitiveFailure
            ? null
            : new Date(Date.now() + REFUND_RETRY_DELAY_MS),
      },
    );

    if (definitiveFailure) {
      await this.failSubscriptionRefund(
        refundRecord.id,
        refund.failure_reason ?? `Stripe refund ${refund.status}`,
      );
      throw new BadRequestException('Refund could not be processed');
    }
    if (refund.status !== 'succeeded') return RefundStatus.PROCESSING;

    try {
      await this.subscriptionPaymentRepo.manager.transaction((manager) =>
        this.finalizeSubscriptionRefund(manager, refundRecord.id, refund.id),
      );
      return RefundStatus.SUCCEEDED;
    } catch (error) {
      this.logger.error(
        `Stripe refund ${refund.id} succeeded but local subscription refund ${refundRecord.id} did not finalize: ${this.errorMessage(error)}`,
      );
      throw error;
    }
  }

  private async failSubscriptionRefund(
    refundId: number,
    message: string,
  ): Promise<void> {
    await this.subscriptionPaymentRepo.manager.transaction(async (manager) => {
      const refunds = manager.withRepository(this.subscriptionRefundRepo);
      const refundSnapshot = await refunds.findOneBy({ id: refundId });
      if (!refundSnapshot) return;
      const payments = manager.getRepository(SubscriptionPayment);
      await payments.findOne({
        where: { id: refundSnapshot.paymentId },
        lock: { mode: 'pessimistic_write' },
      });
      const refund = await refunds.findOne({
        where: { id: refundId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!refund || refund.status === RefundStatus.SUCCEEDED) return;
      await payments.update(
        { id: refund.paymentId, status: PaymentStatus.REFUND_PENDING },
        { status: PaymentStatus.PAID },
      );
      await refunds.update(
        { id: refund.id },
        {
          status: RefundStatus.FAILED,
          lastError: message,
          nextRetryAt: null,
        },
      );
    });
  }

  private async finalizeSubscriptionRefund(
    manager: EntityManager,
    refundId: number,
    providerRefundId: string,
  ): Promise<void> {
    const refunds = manager.getRepository(SubscriptionRefund);
    const refundSnapshot = await refunds.findOneBy({ id: refundId });
    if (!refundSnapshot)
      throw new NotFoundException(`Subscription refund ${refundId} not found`);

    const payments = manager.getRepository(SubscriptionPayment);
    const payment = await payments.findOne({
      where: { id: refundSnapshot.paymentId },
      lock: { mode: 'pessimistic_write' },
    });
    if (!payment)
      throw new NotFoundException(
        `Subscription payment ${refundSnapshot.paymentId} not found`,
      );

    const refund = await refunds.findOne({
      where: { id: refundId },
      lock: { mode: 'pessimistic_write' },
    });
    if (!refund)
      throw new NotFoundException(`Subscription refund ${refundId} not found`);
    if (refund.status === RefundStatus.SUCCEEDED) return;

    const refundedAt = new Date();
    await payments.update(
      { id: payment.id },
      {
        status: PaymentStatus.REFUNDED,
        refundedAmount: payment.amount,
        refundReference: providerRefundId,
        refundedAt,
      },
    );
    await this.paymentStatus.downgradeRefundedPlan(payment, payments, manager);
    await refunds.update(
      { id: refund.id },
      {
        providerRefundId,
        providerStatus: 'succeeded',
        status: RefundStatus.SUCCEEDED,
        completedAt: refundedAt,
        nextRetryAt: null,
        lastError: null,
      },
    );
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
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
    else {
      const pendingRefund = await this.subscriptionRefundRepo.findOne({
        where: { subscriptionId: subscription.id },
        order: { id: 'DESC' },
      });
      if (
        pendingRefund &&
        (pendingRefund.status === RefundStatus.PENDING ||
          pendingRefund.status === RefundStatus.PROCESSING)
      ) {
        // Keep the current plan until Stripe confirms the existing refund.
      } else {
        await this.subscriptions.downgradeToFree(subscription.id);
      }
    }
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
      const pendingRefund = await this.subscriptionRefundRepo.findOne({
        where: { subscriptionId: subscription.id },
        order: { id: 'DESC' },
      });
      if (
        pendingRefund &&
        (pendingRefund.status === RefundStatus.PENDING ||
          pendingRefund.status === RefundStatus.PROCESSING)
      ) {
        return this.subscriptionRefundResponse(
          subscription.id,
          pendingRefund.status,
        );
      }
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
      return this.subscriptionRefundResponse(
        subscription.id,
        RefundStatus.SUCCEEDED,
      );
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

    const refundStatus = await this.refundSubscriptionPayment(latestPaid);
    return this.subscriptionRefundResponse(subscription.id, refundStatus);
  }

  private async subscriptionRefundResponse(
    subscriptionId: number,
    refundStatus: RefundStatus | null,
  ) {
    return {
      subscription: await this.subscriptionRepo.findOneBy({
        id: subscriptionId,
      }),
      refundStatus,
    };
  }

  async refundedSubscriptionPayment(
    paymentRef: string,
    refund: {
      amountRefunded: number;
      refundReference: string | null;
      providerStatus?: string | null;
      refundRecordId?: number | null;
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

    const refunds = manager
      ? manager.getRepository(SubscriptionRefund)
      : this.subscriptionRefundRepo;
    const localRefund = await refunds.findOne({
      where: { paymentId: payment.id },
      ...(manager ? { lock: { mode: 'pessimistic_write' as const } } : {}),
    });
    const matchesLocalRefund =
      localRefund != null &&
      (refund.refundRecordId != null
        ? refund.refundRecordId === localRefund.id
        : refund.refundReference != null &&
          refund.refundReference === localRefund.providerRefundId);
    if (localRefund && !matchesLocalRefund) return;
    if (
      localRefund &&
      (refund.providerStatus === 'failed' ||
        refund.providerStatus === 'canceled')
    ) {
      await refunds.update(
        { id: localRefund.id },
        {
          providerStatus: refund.providerStatus,
          status: RefundStatus.FAILED,
          nextRetryAt: null,
          lastError: `Stripe refund ${refund.providerStatus}`,
        },
      );
      await repository.update(
        { id: payment.id, status: PaymentStatus.REFUND_PENDING },
        { status: PaymentStatus.PAID },
      );
      return;
    }
    if (localRefund && status === PaymentStatus.REFUNDED) {
      const providerRefundId =
        refund.refundReference ?? localRefund.providerRefundId;
      await refunds.update(
        { id: localRefund.id },
        {
          providerRefundId,
          providerStatus: 'succeeded',
          status: RefundStatus.PROCESSING,
          nextRetryAt: providerRefundId
            ? null
            : new Date(Date.now() + REFUND_RETRY_DELAY_MS),
        },
      );
      if (providerRefundId) {
        if (manager)
          await this.finalizeSubscriptionRefund(
            manager,
            localRefund.id,
            providerRefundId,
          );
        else
          await this.subscriptionPaymentRepo.manager.transaction(
            (transactionManager) =>
              this.finalizeSubscriptionRefund(
                transactionManager,
                localRefund.id,
                providerRefundId,
              ),
          );
      }
      return;
    }
    if (localRefund) {
      await refunds.update(
        { id: localRefund.id },
        {
          providerRefundId:
            refund.refundReference ?? localRefund.providerRefundId,
          providerStatus: refund.providerStatus ?? localRefund.providerStatus,
          status: RefundStatus.PROCESSING,
          nextRetryAt: new Date(Date.now() + REFUND_RETRY_DELAY_MS),
        },
      );
      return;
    }

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
      await this.paymentStatus.downgradeRefundedPlan(
        payment,
        repository,
        manager,
      );
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
}
