import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import { TenantService } from 'src/modules/tenants/tenant.service';
import { TenantManagerService } from 'src/modules/tenants/services/tenant-manager.service';
import { TenantRef } from 'src/modules/tenants/utils/tenant.utils';
import { User } from 'src/modules/users/entities/user.entity';
import { Product } from 'src/modules/products/entities/product.entity';
import { RoleKey } from 'src/common/constants/RoleKey.enum';
import { TenantUsageCounter } from '../entities/tenant-usage-counter.entity';
import { SubscriptionService } from './subscription.service';
import { SubscriptionLimitKey } from '../constants/subscription-limit-key.enum';
import { UsageMetric } from '../constants/usage-metric.enum';

export interface UsageValue {
  used: number;
  limit: number | null;
  remaining: number | null;
}

export type UsageSummary = Record<SubscriptionLimitKey, UsageValue>;

const STORE_ADMIN_ROLE_KEYS = [RoleKey.STORE_OWNER, RoleKey.ADMIN];

/** First day of the current UTC month as `YYYY-MM-DD`. */
export const currentUtcPeriodStart = (now: Date = new Date()): string => {
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  return `${year}-${month}-01`;
};

@Injectable()
export class SubscriptionUsageService {
  constructor(
    @InjectRepository(TenantUsageCounter)
    private readonly counterRepo: Repository<TenantUsageCounter>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly tenantService: TenantService,
    private readonly tenantManager: TenantManagerService,
    private readonly subscriptions: SubscriptionService,
  ) {}

  async getStorageUsage(ref: TenantRef): Promise<number> {
    const tenant = await this.tenantService.findBySchemaName(ref.schemaName);
    return tenant ? Number(tenant.storageUsedBytes) : 0;
  }

  async getDatabaseUsage(ref: TenantRef): Promise<number> {
    const sizes = await this.tenantService.getSchemaSizes([ref.schemaName]);
    return sizes.get(ref.schemaName) ?? 0;
  }

  async getStoreAdminUsage(ref: TenantRef): Promise<number> {
    const userRepo = await this.tenantManager.getRepository(User, ref);
    return userRepo.count({
      where: { role: { key: In(STORE_ADMIN_ROLE_KEYS) } },
    });
  }

  async getProductUsage(ref: TenantRef): Promise<number> {
    const productRepo = await this.tenantManager.getRepository(Product, ref);
    return productRepo.count();
  }

  async getMonthlyCouponUsage(tenantId: number): Promise<number> {
    const counter = await this.counterRepo.findOneBy({
      tenantId,
      metric: UsageMetric.COUPONS_PER_MONTH,
      periodStart: currentUtcPeriodStart(),
    });
    return counter?.used ?? 0;
  }

  async getMonthlyCouponUsageByRef(ref: TenantRef): Promise<number> {
    const tenant = await this.tenantService.findBySchemaName(ref.schemaName);
    if (!tenant) return 0;
    return this.getMonthlyCouponUsage(tenant.id);
  }

  async getUsageSummary(ref: TenantRef): Promise<UsageSummary> {
    const [storageLimit, databaseLimit, adminLimit, couponLimit, productLimit] =
      await Promise.all([
        this.subscriptions.getLimit(ref, SubscriptionLimitKey.STORAGE_BYTES),
        this.subscriptions.getLimit(ref, SubscriptionLimitKey.DATABASE_BYTES),
        this.subscriptions.getLimit(ref, SubscriptionLimitKey.STORE_ADMINS),
        this.subscriptions.getLimit(
          ref,
          SubscriptionLimitKey.COUPONS_PER_MONTH,
        ),
        this.subscriptions.getLimit(ref, SubscriptionLimitKey.PRODUCTS),
      ]);

    const [storageUsed, databaseUsed, adminUsed, couponUsed, productUsed] =
      await Promise.all([
        this.getStorageUsage(ref),
        this.getDatabaseUsage(ref),
        this.getStoreAdminUsage(ref),
        this.getMonthlyCouponUsageByRef(ref),
        this.getProductUsage(ref),
      ]);

    return this.assembleSummary({
      storage: { used: storageUsed, limit: storageLimit },
      database: { used: databaseUsed, limit: databaseLimit },
      admins: { used: adminUsed, limit: adminLimit },
      coupons: { used: couponUsed, limit: couponLimit },
      products: { used: productUsed, limit: productLimit },
    });
  }

  /**
   * Platform-scoped variant of `getUsageSummary` used by the super admin console.
   * Resolves the tenant schema from the tenant id, then reads limits by id and
   * live usage from the tenant schema / public counters.
   */
  async getUsageSummaryByTenantId(tenantId: number): Promise<UsageSummary> {
    const tenant = await this.tenantService.findById(tenantId);
    const ref: TenantRef = { schemaName: tenant.schemaName };

    const [storageLimit, databaseLimit, adminLimit, couponLimit, productLimit] =
      await Promise.all([
        this.subscriptions.getLimitById(
          tenantId,
          SubscriptionLimitKey.STORAGE_BYTES,
        ),
        this.subscriptions.getLimitById(
          tenantId,
          SubscriptionLimitKey.DATABASE_BYTES,
        ),
        this.subscriptions.getLimitById(
          tenantId,
          SubscriptionLimitKey.STORE_ADMINS,
        ),
        this.subscriptions.getLimitById(
          tenantId,
          SubscriptionLimitKey.COUPONS_PER_MONTH,
        ),
        this.subscriptions.getLimitById(
          tenantId,
          SubscriptionLimitKey.PRODUCTS,
        ),
      ]);

    const [storageUsed, databaseUsed, adminUsed, couponUsed, productUsed] =
      await Promise.all([
        this.getStorageUsage(ref),
        this.getDatabaseUsage(ref),
        this.getStoreAdminUsage(ref),
        this.getMonthlyCouponUsage(tenantId),
        this.getProductUsage(ref),
      ]);

    return this.assembleSummary({
      storage: { used: storageUsed, limit: storageLimit },
      database: { used: databaseUsed, limit: databaseLimit },
      admins: { used: adminUsed, limit: adminLimit },
      coupons: { used: couponUsed, limit: couponLimit },
      products: { used: productUsed, limit: productLimit },
    });
  }

  private assembleSummary(metrics: {
    storage: { used: number; limit: number | null };
    database: { used: number; limit: number | null };
    admins: { used: number; limit: number | null };
    coupons: { used: number; limit: number | null };
    products: { used: number; limit: number | null };
  }): UsageSummary {
    return {
      [SubscriptionLimitKey.STORAGE_BYTES]: this.usage(
        metrics.storage.used,
        metrics.storage.limit,
      ),
      [SubscriptionLimitKey.DATABASE_BYTES]: this.usage(
        metrics.database.used,
        metrics.database.limit,
      ),
      [SubscriptionLimitKey.STORE_ADMINS]: this.usage(
        metrics.admins.used,
        metrics.admins.limit,
      ),
      [SubscriptionLimitKey.COUPONS_PER_MONTH]: this.usage(
        metrics.coupons.used,
        metrics.coupons.limit,
      ),
      [SubscriptionLimitKey.PRODUCTS]: this.usage(
        metrics.products.used,
        metrics.products.limit,
      ),
    };
  }

  /**
   * Atomically increments the calendar-month coupon counter. The guarded
   * `ON CONFLICT ... WHERE used < limit RETURNING` upsert is the real
   * concurrency guard: no row is returned once the limit is reached, which
   * throws `COUPON_MONTHLY_LIMIT_REACHED`. Unlimited plans (limit `null`) still
   * count usage but never reject.
   */
  async consumeCouponQuota(
    tenantId: number,
    manager?: EntityManager,
  ): Promise<number> {
    const limit = await this.subscriptions.getLimitById(
      tenantId,
      SubscriptionLimitKey.COUPONS_PER_MONTH,
    );
    const em = manager ?? this.dataSource.manager;
    const periodStart = currentUtcPeriodStart();
    const metric = UsageMetric.COUPONS_PER_MONTH;

    if (limit == null) {
      const rows: { used: string | number }[] = await em.query(
        `INSERT INTO "tenant_usage_counters"
           ("tenantId", "metric", "periodStart", "used")
         VALUES ($1, $2, $3, 1)
         ON CONFLICT ("tenantId", "metric", "periodStart")
         DO UPDATE SET "used" = "tenant_usage_counters"."used" + 1
         RETURNING "used"`,
        [tenantId, metric, periodStart],
      );
      return Number(rows[0]?.used ?? 0);
    }

    const rows: { used: string | number }[] = await em.query(
      `INSERT INTO "tenant_usage_counters"
         ("tenantId", "metric", "periodStart", "used")
       VALUES ($1, $2, $3, 1)
       ON CONFLICT ("tenantId", "metric", "periodStart")
       DO UPDATE SET "used" = "tenant_usage_counters"."used" + 1
       WHERE "tenant_usage_counters"."used" < $4
       RETURNING "used"`,
      [tenantId, metric, periodStart, limit],
    );

    if (rows.length === 0)
      throw new BadRequestException({
        code: 'COUPON_MONTHLY_LIMIT_REACHED',
        message: 'Monthly coupon limit reached',
      });

    return Number(rows[0].used);
  }

  /** Guarded decrement used to roll back a reservation when the insert fails. */
  async releaseCouponQuota(
    tenantId: number,
    manager?: EntityManager,
  ): Promise<void> {
    const em = manager ?? this.dataSource.manager;
    await em.query(
      `UPDATE "tenant_usage_counters"
       SET "used" = "used" - 1
       WHERE "tenantId" = $1 AND "metric" = $2 AND "periodStart" = $3 AND "used" > 0`,
      [tenantId, UsageMetric.COUPONS_PER_MONTH, currentUtcPeriodStart()],
    );
  }

  private usage(used: number, limit: number | null): UsageValue {
    return {
      used,
      limit,
      remaining: limit == null ? null : Math.max(limit - used, 0),
    };
  }
}
