import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { TenantRef } from '../tenants/tenant.utils';
import { tenantRefFromContext } from '../auth/tenant-context';
import { Payment } from './entities/payment.entity';
import { Order } from '../orders/entities/order.entity';
import { TenantManagerService } from '../tenants/services/tenant-manager.service';
import { PaymentStatus } from './constants/payment-status.enum';
import { paymentMetaData } from './constants/payment-metadata';

@Injectable()
export default class PaymentService {
  constructor(private readonly tenantManager: TenantManagerService) {}

  async repos(tenant?: TenantRef) {
    const target = tenant ?? tenantRefFromContext();
    if (!target) throw new ForbiddenException('Tenant context is required');
    const [paymentRepo, orderRepo] = await Promise.all([
      this.tenantManager.getRepository(Payment, target),
      this.tenantManager.getRepository(Order, target),
    ]);
    return { paymentRepo, orderRepo };
  }

  async successPayment(
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

  async canceledPayment(
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

  async refundedPayment(
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
    const refundedAmount = refund.amountRefunded / 100;
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

  async failedPayment(
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
}
