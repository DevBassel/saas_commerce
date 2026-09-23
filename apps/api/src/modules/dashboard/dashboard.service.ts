import { ForbiddenException, Injectable } from '@nestjs/common';
import { TenantManagerService } from '../tenants/services/tenant-manager.service';
import { tenantRefFromContext } from '../auth/tenant-context';
import { TenantRef } from '../tenants/tenant.utils';
import { RoleKey } from '../../common/constants/RoleKey.enum';
import { User } from '../users/entities/user.entity';
import { Order } from '../orders/entities/order.entity';
import { OrderStatus } from '../orders/constants/order-status.enum';
import { PaymentStatus } from '../payments/constants/payment-status.enum';
import { DashboardStats } from './constants/dashboard.interface';

const round2 = (value: number): number => Math.round(value * 100) / 100;

@Injectable()
export class DashboardService {
  constructor(private readonly tenantManager: TenantManagerService) {}

  private resolveTenant(tenant?: TenantRef): TenantRef {
    const target = tenant ?? tenantRefFromContext();
    if (!target) throw new ForbiddenException('Tenant context required');
    return target;
  }

  async getStats(tenant?: TenantRef): Promise<DashboardStats> {
    const target = this.resolveTenant(tenant);

    const [orderRepo, userRepo] = await Promise.all([
      this.tenantManager.getRepository(Order, target),
      this.tenantManager.getRepository(User, target),
    ]);

    const [totalOrders, fulfilledOrders, pendingOrders, money, customers] =
      await Promise.all([
        orderRepo.count(),
        orderRepo.count({ where: { status: OrderStatus.DELIVERED } }),
        orderRepo.count({ where: { status: OrderStatus.PENDING } }),
        orderRepo
          .createQueryBuilder('o')
          .select(
            'COALESCE(SUM(CASE WHEN o.paymentStatus = :paid THEN o.total ELSE 0 END), 0)',
            'paid',
          )
          .addSelect(
            'COALESCE(SUM(CASE WHEN o.paymentStatus = :unpaid THEN o.total ELSE 0 END), 0)',
            'waiting',
          )
          .setParameters({
            paid: PaymentStatus.PAID,
            unpaid: PaymentStatus.UNPAID,
          })
          .getRawOne<{ paid: string; waiting: string }>(),
        userRepo
          .createQueryBuilder('u')
          .innerJoin('u.role', 'role')
          .where('role.key = :key', { key: RoleKey.CUSTOMER })
          .getCount(),
      ]);

    return {
      totalOrders,
      fulfilledOrders,
      pendingOrders,
      totalPaid: round2(Number(money?.paid ?? 0)),
      waitingAmount: round2(Number(money?.waiting ?? 0)),
      customers,
    };
  }
}
