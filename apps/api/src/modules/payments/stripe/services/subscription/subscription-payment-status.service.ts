import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { SubscriptionService } from '../../../../subscriptions/services/subscription.service';
import { subscriptionPaymentMetaData } from '../../../constants/payment-metadata';
import { PaymentStatus } from '../../../constants/payment-status.enum';
import { SubscriptionPayment } from '../../../entities/subscription-payment.entity';
import { Subscription } from '../../../entities/subscription.entity';

@Injectable()
export class SubscriptionPaymentStatusService {
  constructor(
    @InjectRepository(Subscription)
    private readonly subscriptionRepo: Repository<Subscription>,
    @InjectRepository(SubscriptionPayment)
    private readonly subscriptionPaymentRepo: Repository<SubscriptionPayment>,
    private readonly subscriptions: SubscriptionService,
  ) {}

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
      payment.status === PaymentStatus.PARTIALLY_REFUNDED ||
      payment.status === PaymentStatus.REFUND_PENDING
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
      payment.status === PaymentStatus.REFUND_PENDING ||
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
      payment.status === PaymentStatus.REFUND_PENDING ||
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

  async downgradeRefundedPlan(
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

  downgradeSubscriptionToFree(subscriptionId: number) {
    return this.subscriptions.downgradeToFree(subscriptionId);
  }
}
