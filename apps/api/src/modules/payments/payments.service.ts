import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TenantRef } from '../tenants/utils/tenant.utils';
import { resolveTenantScope } from '../tenants/utils/tenant-scope';
import { Payment } from './entities/payment.entity';
import { Order } from '../orders/entities/order.entity';
import { SubscriptionPayment } from './entities/subscription-payment.entity';
import { TenantManagerService } from '../tenants/services/tenant-manager.service';
import { PaymentStatus } from './constants/payment-status.enum';
import {
  paymentMetaData,
  subscriptionPaymentMetaData,
} from './constants/payment-metadata';
import { toMajorUnit } from '../../common/utils/money';
import { SubscriptionService } from '../subscriptions/services/subscription.service';

@Injectable()
export default class PaymentService {
  constructor(
    private readonly tenantManager: TenantManagerService,
    @InjectRepository(SubscriptionPayment)
    private readonly subscriptionPaymentRepo: Repository<SubscriptionPayment>,
    private readonly subscriptions: SubscriptionService,
  ) {}

  async repos(tenant?: TenantRef) {
    const target = resolveTenantScope(tenant);
    const [paymentRepo, orderRepo] = await Promise.all([
      this.tenantManager.getRepository(Payment, target),
      this.tenantManager.getRepository(Order, target),
    ]);
    return { paymentRepo, orderRepo };
  }

  async successOrderPayment(
    { orderId, tenant, userId }: paymentMetaData,
    paymentId: string,
  ) {
    const { paymentRepo, orderRepo } = await this.repos({ schemaName: tenant });
    const payment = await paymentRepo.findOne({
      where: { paymentRef: paymentId },
    });
    if (!payment) throw new NotFoundException(`Payment ${paymentId} not found`);
    const order = await orderRepo.findOne({
      where: { id: orderId, userId },
    });
    if (!order) throw new NotFoundException(`Order ${orderId} not found`);

    await Promise.all([
      paymentRepo.save({
        ...payment,
        status: PaymentStatus.PAID,
        paidAt: new Date(),
      }),
      orderRepo.save({
        ...order,
        paymentStatus: PaymentStatus.PAID,
        paidAt: new Date(),
      }),
    ]);
  }

  async cancelOrderPayment(
    { orderId, tenant, userId }: paymentMetaData,
    paymentId: string,
  ) {
    const { paymentRepo, orderRepo } = await this.repos({ schemaName: tenant });
    const payment = await paymentRepo.findOne({
      where: { paymentRef: paymentId },
    });
    if (!payment) throw new NotFoundException(`Payment ${paymentId} not found`);
    const order = await orderRepo.findOne({
      where: { id: orderId, userId },
    });
    if (!order) throw new NotFoundException(`Order ${orderId} not found`);

    await Promise.all([
      paymentRepo.save({
        ...payment,
        status: PaymentStatus.CANCELED,
        canceledAt: new Date(),
      }),
      orderRepo.save({
        ...order,
        paymentStatus: PaymentStatus.UNPAID,
        canceledAt: new Date(),
      }),
    ]);
  }

  async refundedOrderPayment(
    { orderId, tenant, userId }: paymentMetaData,
    refund: {
      paymentIntentId: string;
      amountRefunded: number;
      refundReference: string | null;
    },
  ) {
    const { paymentRepo, orderRepo } = await this.repos({ schemaName: tenant });
    const payment = await paymentRepo.findOne({
      where: { paymentRef: refund.paymentIntentId },
    });
    if (!payment)
      throw new NotFoundException(
        `Payment ${refund.paymentIntentId} not found`,
      );
    const order = await orderRepo.findOne({
      where: { id: orderId, userId },
    });
    if (!order) throw new NotFoundException(`Order ${orderId} not found`);

    // amount_refunded is Stripe's cumulative, authoritative total (in the
    // smallest currency unit). Deriving the status from it makes successful,
    // partial and reversed (failed/canceled) refunds converge on the same
    // state, idempotently.
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

    await Promise.all([
      paymentRepo.save({
        ...payment,
        status,
        refundedAmount,
        refundReference:
          refund.refundReference ??
          (refundedAmount > 0 ? payment.refundReference : null),
        refundedAt,
      }),
      orderRepo.save({
        ...order,
        paymentStatus: status,
        refundedAt,
      }),
    ]);
  }

  async failedOrderPayment(
    { orderId, tenant, userId }: paymentMetaData,
    paymentId: string,
  ) {
    const { paymentRepo, orderRepo } = await this.repos({ schemaName: tenant });
    const payment = await paymentRepo.findOne({
      where: { paymentRef: paymentId },
    });
    if (!payment) throw new NotFoundException(`Payment ${paymentId} not found`);
    const order = await orderRepo.findOne({
      where: { id: orderId, userId },
    });
    if (!order) throw new NotFoundException(`Order ${orderId} not found`);

    await Promise.all([
      paymentRepo.save({
        ...payment,
        status: PaymentStatus.FAILED,
        failedAt: new Date(),
      }),
      orderRepo.save({
        ...order,
        paymentStatus: PaymentStatus.FAILED,
        failedAt: new Date(),
      }),
    ]);
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

    // A fully refunded purchase revokes the plan: fall back to the free plan.
    // Partial refunds keep the paid plan. Idempotent on webhook retries.
    if (status === PaymentStatus.REFUNDED) {
      await this.subscriptions.downgradeToFree(payment.subscriptionId);
    }
  }

  /** Moves a subscription back to the free plan (used by cancel+refund). */
  async downgradeSubscriptionToFree(subscriptionId: number) {
    return this.subscriptions.downgradeToFree(subscriptionId);
  }
}
