import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import Stripe from 'stripe';
import { EntityManager, In } from 'typeorm';
import { TenantCacheService } from 'src/common/cache/tenant-cache.service';
import { toMajorUnit } from 'src/common/utils/money';
import { restoreCouponUsage } from '../../../../coupons/coupon-refund.helper';
import { OrderStatus } from '../../../../orders/constants/order-status.enum';
import { Order } from '../../../../orders/entities/order.entity';
import { Product } from '../../../../products/entities/product.entity';
import { TenantManagerService } from '../../../../tenants/services/tenant-manager.service';
import { resolveTenantScope } from '../../../../tenants/utils/tenant-scope';
import { TenantRef } from '../../../../tenants/utils/tenant.utils';
import { paymentMetaData } from '../../../constants/payment-metadata';
import { PaymentStatus } from '../../../constants/payment-status.enum';
import { RefundStatus } from '../../../constants/refund-status.enum';
import { OrderRefund } from '../../../entities/order-refund.entity';
import { Payment } from '../../../entities/payment.entity';
import { StripeClientService } from '../../stripe-client.service';

const REFUND_RETRY_DELAY_MS = 30_000;

export interface OrderRefundResult {
  refundStatus: RefundStatus;
  refundedAt: Date | null;
}

@Injectable()
export class OrderRefundService {
  private readonly logger = new Logger('StripePaymentService');

  constructor(
    private readonly tenantManager: TenantManagerService,
    private readonly stripeClient: StripeClientService,
    private readonly cache: TenantCacheService,
  ) {}

  private get stripe(): Stripe {
    return this.stripeClient.client;
  }

  private async repos(tenant?: TenantRef) {
    const target = resolveTenantScope(tenant);
    const [paymentRepo, orderRepo] = await Promise.all([
      this.tenantManager.getRepository(Payment, target),
      this.tenantManager.getRepository(Order, target),
    ]);
    return { paymentRepo, orderRepo };
  }

  async refundOrder(
    order: Order,
    targetStatus: OrderStatus,
    tenant?: TenantRef,
  ): Promise<OrderRefundResult | null> {
    const target = resolveTenantScope(tenant);
    const { paymentRepo, orderRepo } = await this.repos(target);
    const refundRepo = await this.tenantManager.getRepository(
      OrderRefund,
      target,
    );

    const refund = await paymentRepo.manager.transaction(async (manager) => {
      const payments = manager.withRepository(paymentRepo);
      const orders = manager.withRepository(orderRepo);
      const refunds = manager.withRepository(refundRepo);
      const payment = await payments.findOne({
        where: {
          orderId: order.id,
          status: In([PaymentStatus.PAID, PaymentStatus.REFUND_PENDING]),
        },
        order: { id: 'DESC' },
        lock: { mode: 'pessimistic_write' },
      });
      if (!payment) return null;
      if (!payment.paymentRef)
        throw new BadRequestException('Payment reference is missing');

      const currentOrder = await orders.findOne({
        where: { id: order.id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!currentOrder) throw new NotFoundException('Order not found');

      const existing = await refunds.findOne({
        where: { paymentId: payment.id },
        lock: { mode: 'pessimistic_write' },
      });
      if (existing) return existing;
      if (
        payment.status !== PaymentStatus.PAID ||
        currentOrder.paymentStatus !== PaymentStatus.PAID ||
        currentOrder.status !== order.status
      ) {
        throw new ConflictException('Order changed while refund was starting');
      }

      const created = refunds.create({
        paymentId: payment.id,
        orderId: currentOrder.id,
        sourceOrderStatus: currentOrder.status,
        targetOrderStatus: targetStatus,
        amount: payment.amount,
        currency: payment.currency,
        idempotencyKey: `refund:order:${target.schemaName}:${payment.id}:v1`,
        status: RefundStatus.PENDING,
        attempts: 0,
      });
      const saved = await refunds.save(created);
      await payments.update(
        { id: payment.id },
        { status: PaymentStatus.REFUND_PENDING },
      );
      await orders.update(
        { id: currentOrder.id },
        { paymentStatus: PaymentStatus.REFUND_PENDING },
      );
      return saved;
    });

    if (!refund) return null;
    if (refund.status === RefundStatus.SUCCEEDED) {
      return {
        refundStatus: refund.status,
        refundedAt: refund.completedAt,
      };
    }
    if (refund.status === RefundStatus.FAILED)
      throw new BadRequestException('Refund could not be processed');
    return this.submitOrderRefund(refund, target);
  }

  async reconcileRefunds(
    tenant: TenantRef,
    limit = 100,
  ): Promise<{ attempted: number; processed: number; failed: number }> {
    const target = resolveTenantScope(tenant);
    const refundRepo = await this.tenantManager.getRepository(
      OrderRefund,
      target,
    );
    const refunds = await refundRepo
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
        const result = await this.submitOrderRefund(refund, target);
        if (result.refundStatus === RefundStatus.SUCCEEDED) processed += 1;
        if (result.refundStatus === RefundStatus.FAILED) failed += 1;
      } catch (error) {
        failed += 1;
        this.logger.error(
          `Order refund reconciliation failed for ${refund.id}: ${this.errorMessage(error)}`,
        );
      }
    }
    return { attempted: refunds.length, processed, failed };
  }

  private async submitOrderRefund(
    refundRecord: OrderRefund,
    tenant: TenantRef,
  ): Promise<OrderRefundResult> {
    const refundRepo = await this.tenantManager.getRepository(
      OrderRefund,
      tenant,
    );
    const paymentRepo = await this.tenantManager.getRepository(Payment, tenant);
    const payment = await paymentRepo.findOneBy({ id: refundRecord.paymentId });
    if (!payment?.paymentRef)
      throw new BadRequestException('Payment reference is missing');

    await refundRepo.update(
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
              reverse_transfer: true,
              refund_application_fee: true,
              metadata: {
                durable_refund_id: String(refundRecord.id),
                durable_refund_kind: 'order',
                tenant_schema: tenant.schemaName,
              },
            },
            { idempotencyKey: refundRecord.idempotencyKey },
          );
    } catch (error) {
      const message = this.errorMessage(error);
      if (error instanceof Stripe.errors.StripeInvalidRequestError) {
        await this.failOrderRefund(refundRecord.id, tenant, message);
        this.logger.warn(
          `Stripe refund failed for payment ${payment.id}: ${error.code ?? error.message}`,
        );
        throw new BadRequestException('Refund could not be processed');
      }
      await refundRepo.update(
        { id: refundRecord.id },
        {
          status: RefundStatus.PENDING,
          lastError: message,
          nextRetryAt: new Date(Date.now() + REFUND_RETRY_DELAY_MS),
        },
      );
      return { refundStatus: RefundStatus.PENDING, refundedAt: null };
    }

    const definitiveFailure =
      refund.status === 'failed' || refund.status === 'canceled';
    await refundRepo.update(
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
      await this.failOrderRefund(
        refundRecord.id,
        tenant,
        refund.failure_reason ?? `Stripe refund ${refund.status}`,
      );
      throw new BadRequestException('Refund could not be processed');
    }
    if (refund.status !== 'succeeded') {
      return { refundStatus: RefundStatus.PROCESSING, refundedAt: null };
    }

    try {
      const refundedAt = await paymentRepo.manager.transaction((manager) =>
        this.finalizeOrderRefund(manager, refundRecord.id, refund.id),
      );
      await this.cache.invalidateProducts(tenant);
      return { refundStatus: RefundStatus.SUCCEEDED, refundedAt };
    } catch (error) {
      this.logger.error(
        `Stripe refund ${refund.id} succeeded but local order refund ${refundRecord.id} did not finalize: ${this.errorMessage(error)}`,
      );
      throw error;
    }
  }

  private async failOrderRefund(
    refundId: number,
    tenant: TenantRef,
    message: string,
  ): Promise<void> {
    const { paymentRepo, orderRepo } = await this.repos(tenant);
    const refundRepo = await this.tenantManager.getRepository(
      OrderRefund,
      tenant,
    );
    await paymentRepo.manager.transaction(async (manager) => {
      const refunds = manager.withRepository(refundRepo);
      const refundSnapshot = await refunds.findOneBy({ id: refundId });
      if (!refundSnapshot) return;
      const payments = manager.withRepository(paymentRepo);
      const orders = manager.withRepository(orderRepo);
      await payments.findOne({
        where: { id: refundSnapshot.paymentId },
        lock: { mode: 'pessimistic_write' },
      });
      await orders.findOne({
        where: { id: refundSnapshot.orderId },
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
      await orders.update(
        { id: refund.orderId, paymentStatus: PaymentStatus.REFUND_PENDING },
        { paymentStatus: PaymentStatus.PAID },
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

  private async finalizeOrderRefund(
    manager: EntityManager,
    refundId: number,
    providerRefundId: string,
  ): Promise<Date> {
    const refunds = manager.getRepository(OrderRefund);
    const refundSnapshot = await refunds.findOneBy({ id: refundId });
    if (!refundSnapshot)
      throw new NotFoundException(`Order refund ${refundId} not found`);

    const payments = manager.getRepository(Payment);
    const payment = await payments.findOne({
      where: { id: refundSnapshot.paymentId },
      lock: { mode: 'pessimistic_write' },
    });
    if (!payment)
      throw new NotFoundException(
        `Payment ${refundSnapshot.paymentId} not found`,
      );

    const orders = manager.getRepository(Order);
    const order = await orders.findOne({
      where: { id: refundSnapshot.orderId },
      relations: { items: true },
      relationLoadStrategy: 'query',
      lock: { mode: 'pessimistic_write' },
    });
    if (!order)
      throw new NotFoundException(`Order ${refundSnapshot.orderId} not found`);

    const refund = await refunds.findOne({
      where: { id: refundId },
      lock: { mode: 'pessimistic_write' },
    });
    if (!refund)
      throw new NotFoundException(`Order refund ${refundId} not found`);
    if (refund.status === RefundStatus.SUCCEEDED)
      return refund.completedAt ?? new Date();

    const refundedAt = new Date();
    if (order.status !== refund.targetOrderStatus) {
      if (order.status !== refund.sourceOrderStatus) {
        throw new ConflictException(
          `Order ${order.id} changed while refund was pending`,
        );
      }
      const transitioned = await orders.update(
        { id: order.id, status: refund.sourceOrderStatus },
        {
          status: refund.targetOrderStatus,
          paymentStatus: PaymentStatus.REFUNDED,
          refundedAt,
        },
      );
      if (transitioned.affected !== 1)
        throw new ConflictException(
          'Order status changed; retry reconciliation',
        );

      const products = manager.getRepository(Product);
      for (const item of order.items ?? []) {
        if (item.productId != null)
          await products.increment(
            { id: item.productId },
            'stock',
            item.quantity,
          );
      }
      await restoreCouponUsage(manager, order);
    } else {
      await orders.update(
        { id: order.id },
        { paymentStatus: PaymentStatus.REFUNDED, refundedAt },
      );
    }

    await payments.update(
      { id: payment.id },
      {
        status: PaymentStatus.REFUNDED,
        refundedAmount: payment.amount,
        refundReference: providerRefundId,
        refundedAt,
      },
    );
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
    return refundedAt;
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }

  async refundedOrderPayment(
    { orderId, tenant, userId }: paymentMetaData,
    refund: {
      paymentIntentId: string;
      amountRefunded: number;
      refundReference: string | null;
      providerStatus?: string | null;
      refundRecordId?: number | null;
    },
  ) {
    const { paymentRepo, orderRepo } = await this.repos({
      schemaName: tenant,
    });

    let restoredStock = false;
    const result = await paymentRepo.manager.transaction(async (manager) => {
      const paymentRepository = manager.withRepository(paymentRepo);
      const orderRepository = manager.withRepository(orderRepo);

      const payment = await paymentRepository.findOne({
        where: { paymentRef: refund.paymentIntentId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!payment) {
        throw new NotFoundException(
          `Payment ${refund.paymentIntentId} not found`,
        );
      }

      const order = await orderRepository.findOne({
        where: { id: orderId, userId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!order) {
        throw new NotFoundException(`Order ${orderId} not found`);
      }

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

      const localRefund = await manager.getRepository(OrderRefund).findOne({
        where: { paymentId: payment.id },
        lock: { mode: 'pessimistic_write' },
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
        await manager.getRepository(OrderRefund).update(
          { id: localRefund.id },
          {
            providerStatus: refund.providerStatus,
            status: RefundStatus.FAILED,
            nextRetryAt: null,
            lastError: `Stripe refund ${refund.providerStatus}`,
          },
        );
        await paymentRepository.update(
          { id: payment.id, status: PaymentStatus.REFUND_PENDING },
          { status: PaymentStatus.PAID },
        );
        await orderRepository.update(
          { id: order.id, paymentStatus: PaymentStatus.REFUND_PENDING },
          { paymentStatus: PaymentStatus.PAID },
        );
        return;
      }
      if (localRefund && status === PaymentStatus.REFUNDED) {
        const providerRefundId =
          refund.refundReference ?? localRefund.providerRefundId;
        await manager.getRepository(OrderRefund).update(
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
          const completedAt = await this.finalizeOrderRefund(
            manager,
            localRefund.id,
            providerRefundId,
          );
          restoredStock = true;
          return {
            paymentId: payment.id,
            orderId: order.id,
            status: PaymentStatus.REFUNDED,
            refundedAmount,
            refundedAt: completedAt,
          };
        }
        return;
      }
      if (localRefund) {
        await manager.getRepository(OrderRefund).update(
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

      paymentRepository.merge(payment, {
        status,
        refundedAmount,
        refundReference:
          refund.refundReference ??
          (refundedAmount > 0 ? payment.refundReference : null),
        refundedAt,
      });

      orderRepository.merge(order, {
        paymentStatus: status,
        refundedAt,
      });

      await paymentRepository.save(payment);
      await orderRepository.save(order);

      return {
        paymentId: payment.id,
        orderId: order.id,
        status,
        refundedAmount,
        refundedAt,
      };
    });
    if (restoredStock)
      await this.cache.invalidateProducts({ schemaName: tenant });
    return result;
  }
}
