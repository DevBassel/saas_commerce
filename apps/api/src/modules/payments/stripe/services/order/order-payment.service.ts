import { Injectable } from '@nestjs/common';
import { RequestWithUser } from '../../../../auth/interfaces/RequestWithUser.interface';
import { OrderStatus } from '../../../../orders/constants/order-status.enum';
import { Order } from '../../../../orders/entities/order.entity';
import { TenantManagerService } from '../../../../tenants/services/tenant-manager.service';
import { resolveTenantScope } from '../../../../tenants/utils/tenant-scope';
import { TenantRef } from '../../../../tenants/utils/tenant.utils';
import { paymentMetaData } from '../../../constants/payment-metadata';
import { CreatePaymentDto } from '../../../dto/create-payment.dto';
import { Payment } from '../../../entities/payment.entity';
import { OrderPaymentIntentService } from './order-payment-intent.service';
import { OrderPaymentStatusService } from './order-payment-status.service';
import {
  OrderRefundService,
  type OrderRefundResult,
} from './order-refund.service';

export type { OrderRefundResult } from './order-refund.service';

@Injectable()
export class OrderPaymentService {
  constructor(
    private readonly tenantManager: TenantManagerService,
    private readonly paymentIntents: OrderPaymentIntentService,
    private readonly paymentStatus: OrderPaymentStatusService,
    private readonly orderRefunds: OrderRefundService,
  ) {}

  async repos(tenant?: TenantRef) {
    const target = resolveTenantScope(tenant);
    const [paymentRepo, orderRepo] = await Promise.all([
      this.tenantManager.getRepository(Payment, target),
      this.tenantManager.getRepository(Order, target),
    ]);
    return { paymentRepo, orderRepo };
  }

  async createOrderPaymentIntent(
    createPaymentDto: CreatePaymentDto,
    user: RequestWithUser['user'],
  ) {
    const { orderRepo } = await this.repos();
    return this.paymentIntents.createOrderPaymentIntent(
      orderRepo,
      createPaymentDto,
      user,
    );
  }

  refundOrder(
    order: Order,
    targetStatus: OrderStatus,
    tenant?: TenantRef,
  ): Promise<OrderRefundResult | null> {
    return this.orderRefunds.refundOrder(order, targetStatus, tenant);
  }

  reconcileRefunds(
    tenant: TenantRef,
    limit = 100,
  ): Promise<{ attempted: number; processed: number; failed: number }> {
    return this.orderRefunds.reconcileRefunds(tenant, limit);
  }

  async successOrderPayment(metadata: paymentMetaData, paymentId: string) {
    const { tenant } = metadata;
    const { paymentRepo, orderRepo } = await this.repos({
      schemaName: tenant,
    });
    return this.paymentStatus.successOrderPayment(
      paymentRepo,
      orderRepo,
      metadata,
      paymentId,
    );
  }

  async cancelOrderPayment(metadata: paymentMetaData, paymentId: string) {
    const { tenant } = metadata;
    const { paymentRepo, orderRepo } = await this.repos({
      schemaName: tenant,
    });
    return this.paymentStatus.cancelOrderPayment(
      paymentRepo,
      orderRepo,
      metadata,
      paymentId,
    );
  }

  refundedOrderPayment(
    metadata: paymentMetaData,
    refund: {
      paymentIntentId: string;
      amountRefunded: number;
      refundReference: string | null;
      providerStatus?: string | null;
      refundRecordId?: number | null;
    },
  ) {
    return this.orderRefunds.refundedOrderPayment(metadata, refund);
  }

  async failedOrderPayment(metadata: paymentMetaData, paymentId: string) {
    const { tenant } = metadata;
    const { paymentRepo, orderRepo } = await this.repos({
      schemaName: tenant,
    });
    return this.paymentStatus.failedOrderPayment(
      paymentRepo,
      orderRepo,
      metadata,
      paymentId,
    );
  }
}
