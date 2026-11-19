import {
  BadRequestException,
  ConflictException,
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
    ): Promise<{ order: Order; needsRefund: boolean }> => {
      const found = await findOrderForUpdate(manager, id);
      if (!found) throw new NotFoundException('Order not found');

      const allowed = ALLOWED_TRANSITIONS[found.status] ?? [];
      if (!allowed.includes(next)) {
        throw new BadRequestException(
          `Cannot change order status from ${found.status} to ${next}`,
        );
      }
      if (found.paymentStatus === PaymentStatus.REFUND_PENDING) {
        throw new ConflictException('Refund is already pending');
      }
      if (restockable && found.paymentStatus === PaymentStatus.PAID) {
        return { order: found, needsRefund: true };
      }

      const order = await transitionOrderStatus(manager, found, next);
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
      // Refund coordinator acquires fresh locks and owns all final side effects.
      await refundOrderIfPaid(result.order, next, target, this.payments);
      const refreshed = await orderRepo.findOne({
        where: { id },
        relations: { items: true },
      });
      if (!refreshed) throw new NotFoundException('Order not found');
      result = { order: refreshed, needsRefund: false };
    }

    if (restockable) await this.cache.invalidateProducts(target);

    return serializeOrder(result.order, this.r2);
  }
}
