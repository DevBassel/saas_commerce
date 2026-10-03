import { Injectable, Logger } from '@nestjs/common';
import { TenantManagerService } from '../tenants/services/tenant-manager.service';
import { TenantService } from '../tenants/tenant.service';
import { TenantRef } from '../tenants/utils/tenant.utils';
import { resolveTenantScope } from '../tenants/utils/tenant-scope';
import { round2, toMajorUnit } from '../../common/utils/money';
import { RoleKey } from '../../common/constants/RoleKey.enum';
import { User } from '../users/entities/user.entity';
import { Order } from '../orders/entities/order.entity';
import { OrderStatus } from '../orders/constants/order-status.enum';
import StripePaymentService from '../payments/stripe.payment.service';
import { DashboardStats } from './constants/dashboard.interface';

// Stripe balance amounts are in the smallest currency unit (cents).
const sumCents = (entries: { amount: number }[]): number =>
  round2(
    toMajorUnit(entries.reduce((total, entry) => total + entry.amount, 0)),
  );

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(
    private readonly tenantManager: TenantManagerService,
    private readonly tenantService: TenantService,
    private readonly stripePaymentService: StripePaymentService,
  ) {}

  /**
   * Reads the tenant's connected-account balance. Available funds map to
   * "Total Paid" and funds still pending map to "Waiting Money". A missing
   * account, a deleted account, or a Stripe outage all fall back to zero so
   * the rest of the dashboard still renders.
   */
  private async getStripeBalance(
    accountId?: string | null,
  ): Promise<{ available: number; pending: number }> {
    const empty = { available: 0, pending: 0 };
    if (!accountId) return empty;

    try {
      const balance = await this.stripePaymentService.getBalance(accountId);
      if (!balance) return empty;
      return {
        available: sumCents(balance.available),
        pending: sumCents(balance.pending),
      };
    } catch (error) {
      this.logger.warn(
        `Stripe balance unavailable for ${accountId}: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );
      return empty;
    }
  }

  async getStats(tenant?: TenantRef): Promise<DashboardStats> {
    const target = resolveTenantScope(tenant);

    const [orderRepo, userRepo, tenantRow] = await Promise.all([
      this.tenantManager.getRepository(Order, target),
      this.tenantManager.getRepository(User, target),
      this.tenantService.findBySchemaName(target.schemaName),
    ]);

    const [totalOrders, fulfilledOrders, pendingOrders, customers, balance] =
      await Promise.all([
        orderRepo.count(),
        orderRepo.count({ where: { status: OrderStatus.DELIVERED } }),
        orderRepo.count({ where: { status: OrderStatus.PENDING } }),
        userRepo
          .createQueryBuilder('u')
          .innerJoin('u.role', 'role')
          .where('role.key = :key', { key: RoleKey.CUSTOMER })
          .getCount(),
        this.getStripeBalance(tenantRow?.stripeAccountId),
      ]);

    return {
      totalOrders,
      fulfilledOrders,
      pendingOrders,
      totalPaid: balance.available,
      waitingAmount: balance.pending,
      customers,
      storageUsedBytes: Number(tenantRow?.storageUsedBytes ?? 0),
      storageCapacityBytes: Number(tenantRow?.storageCapacityBytes ?? 0),
    };
  }
}
