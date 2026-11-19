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
  findOrderForUpdate,
  refundOrderIfPaid,
  restockOrderItems,
  serializeOrder,
  transitionOrderStatus,
} from './orders.helpers';
import { TenantCacheService } from '../../common/cache/tenant-cache.service';

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
    private readonly cache: TenantCacheService,
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
    const next = dto.status;
    const restockable =
      next === OrderStatus.CANCELLED || next === OrderStatus.RETURNED;
    const applyTransition = async (
      manager: EntityManager,
      refundedAt?: Date | null,
    ): Promise<{ order: Order; needsRefund: boolean }> => {
      const found = await findOrderForUpdate(manager, id);
      if (!found) throw new NotFoundException('Order not found');

      const allowed = ALLOWED_TRANSITIONS[found.status] ?? [];
      if (!allowed.includes(next)) {
        throw new BadRequestException(
          `Cannot change order status from ${found.status} to ${next}`,
        );
      }
      if (
        restockable &&
        found.paymentStatus === PaymentStatus.PAID &&
        refundedAt === undefined
      ) {
        return { order: found, needsRefund: true };
      }

      const order = await transitionOrderStatus(
        manager,
        found,
        next,
        refundedAt,
      );
      if (restockable) {
        await restockOrderItems(manager, found.items ?? []);
        await this.coupons.restoreUsage(manager, found);
      }
      return { order, needsRefund: false };
    };

    let result = await orderRepo.manager.transaction((manager) =>
      applyTransition(manager),
    );
    if (result.needsRefund) {
      // Never retain an Order lock during Stripe calls; the final transaction
      // must validate the current row again before applying any side effects.
      const refundedAt = await refundOrderIfPaid(
        result.order,
        target,
        this.payments,
      );
      result = await orderRepo.manager.transaction((manager) =>
        applyTransition(manager, refundedAt),
      );
    }

    if (restockable) await this.cache.invalidateProducts(target);

    return serializeOrder(result.order, this.r2);
  }
}
