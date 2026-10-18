import { Injectable, Logger } from '@nestjs/common';
import { TenantManagerService } from '../tenants/services/tenant-manager.service';
import { TenantService } from '../tenants/tenant.service';
import { TenantRef } from '../tenants/utils/tenant.utils';
import { resolveTenantScope } from '../tenants/utils/tenant-scope';
import { RoleKey } from '../../common/constants/RoleKey.enum';
import { User } from '../users/entities/user.entity';
import { Order } from '../orders/entities/order.entity';
import { OrderStatus } from '../orders/constants/order-status.enum';
import StripePaymentService from '../payments/stripe.payment.service';

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(
    private readonly tenantManager: TenantManagerService,
    private readonly tenantService: TenantService,
    private readonly stripePaymentService: StripePaymentService,
  ) {}

  private async getSchemaSizeSafe(schemaName: string): Promise<number> {
    try {
      const sizes = await this.tenantService.getSchemaSizes([schemaName]);
      return sizes.get(schemaName) ?? 0;
    } catch (error) {
      this.logger.warn(
        `Schema size unavailable for ${schemaName}: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );
      return 0;
    }
  }

  async getStats(tenant?: TenantRef) {
    const target = resolveTenantScope(tenant);

    const [orderRepo, userRepo, tenantRow] = await Promise.all([
      this.tenantManager.getRepository(Order, target),
      this.tenantManager.getRepository(User, target),
      this.tenantService.findBySchemaName(target.schemaName),
    ]);

    const [
      totalOrders,
      fulfilledOrders,
      pendingOrders,
      customers,
      balance,
      schemaSize,
    ] = await Promise.all([
      orderRepo.count(),
      orderRepo.count({ where: { status: OrderStatus.DELIVERED } }),
      orderRepo.count({ where: { status: OrderStatus.PENDING } }),
      userRepo
        .createQueryBuilder('u')
        .innerJoin('u.role', 'role')
        .where('role.key = :key', { key: RoleKey.CUSTOMER })
        .getCount(),
      tenantRow?.stripeAccountId
        ? this.stripePaymentService.getBalance(tenantRow.stripeAccountId)
        : null,
      this.getSchemaSizeSafe(target.schemaName),
    ]);

    return {
      totalOrders,
      fulfilledOrders,
      pendingOrders,
      balance,
      customers,
      storageUsedBytes: Number(tenantRow?.storageUsedBytes ?? 0),
      storageCapacityBytes: Number(tenantRow?.storageCapacityBytes ?? 0),
      schemaSizeBytes: schemaSize,
      schemaCapacityBytes: this.tenantService.getSchemaCapacityBytes(),
    };
  }
}
