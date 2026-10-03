import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EntityManager, Repository } from 'typeorm';
import { TenantManagerService } from '../tenants/services/tenant-manager.service';
import { TenantRef } from '../tenants/utils/tenant.utils';
import { resolveTenantScope } from '../tenants/utils/tenant-scope';
import { R2Service } from '../../common/storage/r2.service';
import { PaymentStatus } from '../payments/constants/payment-status.enum';
import StripePaymentService from '../payments/stripe.payment.service';
import { Order } from './entities/order.entity';
import { OrderStatus } from './constants/order-status.enum';
import { CouponsService } from '../coupons/coupons.service';
import { SerializedOrder } from './constants/orders.interface';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import {
  refundOrderIfPaid,
  restockOrderItems,
  serializeOrder,
} from './orders.helpers';

const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  [OrderStatus.PENDING]: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
  [OrderStatus.CONFIRMED]: [OrderStatus.PROCESSING, OrderStatus.CANCELLED],
  [OrderStatus.PROCESSING]: [OrderStatus.SHIPPED, OrderStatus.CANCELLED],
  [OrderStatus.SHIPPED]: [OrderStatus.DELIVERED, OrderStatus.CANCELLED],
  [OrderStatus.DELIVERED]: [OrderStatus.RETURN_REQUESTED],
  [OrderStatus.RETURN_REQUESTED]: [OrderStatus.RETURNED, OrderStatus.DELIVERED],
  [OrderStatus.RETURNED]: [],
  [OrderStatus.CANCELLED]: [],
};

@Injectable()
export class ManageOrderService {
  constructor(
    private readonly tenantManager: TenantManagerService,
    private readonly r2: R2Service,
    private readonly payments: StripePaymentService,
    private readonly coupons: CouponsService,
  ) {}

  private async repos(tenant?: TenantRef): Promise<{
    target: TenantRef;
    orderRepo: Repository<Order>;
  }> {
    const target = resolveTenantScope(tenant);
    const orderRepo = await this.tenantManager.getRepository(Order, target);
    return { target, orderRepo };
  }

  async updateStatus(
    id: number,
    dto: UpdateOrderStatusDto,
    tenant?: TenantRef,
  ): Promise<SerializedOrder> {
    const { target, orderRepo } = await this.repos(tenant);

    const found = await orderRepo.findOne({
      where: { id },
      relations: { items: true },
    });
    if (!found) throw new NotFoundException('Order not found');

    const next = dto.status;
    const allowed = ALLOWED_TRANSITIONS[found.status] ?? [];
    if (!allowed.includes(next)) {
      throw new BadRequestException(
        `Cannot change order status from ${found.status} to ${next}`,
      );
    }

    const restockable =
      next === OrderStatus.CANCELLED || next === OrderStatus.RETURNED;
    const refundedAt = restockable
      ? await refundOrderIfPaid(found, target, this.payments)
      : null;

    await orderRepo.manager.transaction(async (manager: EntityManager) => {
      const orders = manager.getRepository(Order);
      await orders.update(
        { id },
        {
          status: next,
          ...(refundedAt
            ? { paymentStatus: PaymentStatus.REFUNDED, refundedAt }
            : {}),
        },
      );
      if (restockable) {
        await restockOrderItems(manager, found.items ?? []);
        await this.coupons.restoreUsage(manager, found);
      }
    });

    return serializeOrder(
      {
        ...found,
        status: next,
        ...(refundedAt
          ? { paymentStatus: PaymentStatus.REFUNDED, refundedAt }
          : {}),
      } as Order,
      this.r2,
    );
  }
}
