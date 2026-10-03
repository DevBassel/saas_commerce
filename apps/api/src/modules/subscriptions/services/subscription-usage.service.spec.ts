import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  SubscriptionUsageService,
  currentUtcPeriodStart,
} from './subscription-usage.service';
import { SubscriptionLimitKey } from '../constants/subscription-limit-key.enum';
import { UsageMetric } from '../constants/usage-metric.enum';
import { RoleKey } from 'src/common/constants/RoleKey.enum';

const TENANT = { schemaName: 'tenant_test' };

const buildMocks = () => {
  const counterRepo = {
    findOneBy: jest.fn().mockResolvedValue(null),
  };
  const manager = {
    query: jest.fn(),
  };
  const dataSource = { manager };
  const tenantService = {
    findById: jest.fn().mockResolvedValue({ id: 7, schemaName: 'tenant_test' }),
    findBySchemaName: jest.fn().mockResolvedValue({ id: 7 }),
    getSchemaSizes: jest.fn().mockResolvedValue(new Map()),
  };
  const userRepo = { count: jest.fn().mockResolvedValue(0) };
  const tenantManager = {
    getRepository: jest.fn().mockResolvedValue(userRepo),
  };
  const subscriptions = {
    getLimit: jest.fn().mockResolvedValue(null),
    getLimitById: jest.fn().mockResolvedValue(null),
  };

  const service = new SubscriptionUsageService(
    counterRepo as never,
    dataSource as never,
    tenantService as never,
    tenantManager as never,
    subscriptions as never,
  );

  return {
    service,
    counterRepo,
    manager,
    tenantService,
    userRepo,
    tenantManager,
    subscriptions,
  };
};

describe('SubscriptionUsageService', () => {
  it('uses the first day of the current UTC month as the period key', () => {
    expect(currentUtcPeriodStart(new Date('2026-03-17T22:00:00.000Z'))).toBe(
      '2026-03-01',
    );
  });

  it('reads the monthly coupon counter for the current period', async () => {
    const { service, counterRepo } = buildMocks();
    counterRepo.findOneBy.mockResolvedValue({ used: 3 });

    await expect(service.getMonthlyCouponUsage(7)).resolves.toBe(3);
    expect(counterRepo.findOneBy).toHaveBeenCalledWith({
      tenantId: 7,
      metric: UsageMetric.COUPONS_PER_MONTH,
      periodStart: currentUtcPeriodStart(),
    });
  });

  it('returns 0 when no counter row exists', async () => {
    const { service } = buildMocks();
    await expect(service.getMonthlyCouponUsage(7)).resolves.toBe(0);
  });

  it('counts only STORE_OWNER and ADMIN tenant users', async () => {
    const { service, userRepo } = buildMocks();
    userRepo.count.mockResolvedValue(2);

    await expect(service.getStoreAdminUsage(TENANT)).resolves.toBe(2);
    expect(userRepo.count).toHaveBeenCalledTimes(1);
    const countArgs = userRepo.count.mock.calls as unknown[][];
    const where = (
      countArgs[0][0] as {
        where: { role: { key: { _value: string[] } } };
      }
    ).where;
    expect(where.role.key._value).toEqual([RoleKey.STORE_OWNER, RoleKey.ADMIN]);
  });

  it('measures database usage from the tenant schema only', async () => {
    const { service, tenantService } = buildMocks();
    tenantService.getSchemaSizes.mockResolvedValue(
      new Map([['tenant_test', 4096]]),
    );

    await expect(service.getDatabaseUsage(TENANT)).resolves.toBe(4096);
    expect(tenantService.getSchemaSizes).toHaveBeenCalledWith(['tenant_test']);
  });

  it('counts products in the tenant schema', async () => {
    const { service, userRepo } = buildMocks();
    userRepo.count.mockResolvedValue(4);

    await expect(service.getProductUsage(TENANT)).resolves.toBe(4);
    expect(userRepo.count).toHaveBeenCalledTimes(1);
  });

  it('builds a usage summary with remaining values', async () => {
    const { service, subscriptions, userRepo } = buildMocks();
    subscriptions.getLimit.mockImplementation(
      (_ref: unknown, key: SubscriptionLimitKey) =>
        Promise.resolve(key === SubscriptionLimitKey.STORE_ADMINS ? 5 : null),
    );
    userRepo.count.mockResolvedValue(2);

    const summary = await service.getUsageSummary(TENANT);

    expect(summary[SubscriptionLimitKey.STORE_ADMINS]).toEqual({
      used: 2,
      limit: 5,
      remaining: 3,
    });
    expect(summary[SubscriptionLimitKey.STORAGE_BYTES].remaining).toBeNull();
  });

  describe('getUsageSummaryByTenantId', () => {
    it('resolves the schema and reads limits by tenant id', async () => {
      const { service, subscriptions, tenantService, userRepo } = buildMocks();
      subscriptions.getLimitById.mockImplementation(
        (_id: number, key: SubscriptionLimitKey) =>
          Promise.resolve(key === SubscriptionLimitKey.STORE_ADMINS ? 5 : null),
      );
      userRepo.count.mockResolvedValue(2);

      const summary = await service.getUsageSummaryByTenantId(7);

      expect(tenantService.findById).toHaveBeenCalledWith(7);
      expect(subscriptions.getLimitById).toHaveBeenCalledWith(
        7,
        SubscriptionLimitKey.STORAGE_BYTES,
      );
      expect(summary[SubscriptionLimitKey.STORE_ADMINS]).toEqual({
        used: 2,
        limit: 5,
        remaining: 3,
      });
      expect(summary[SubscriptionLimitKey.COUPONS_PER_MONTH]).toEqual({
        used: 0,
        limit: null,
        remaining: null,
      });
    });

    it('propagates the tenant not-found error', async () => {
      const { service, tenantService } = buildMocks();
      tenantService.findById.mockRejectedValueOnce(
        new NotFoundException({
          code: 'TENANT_NOT_FOUND',
          message: 'Tenant not found',
        }),
      );

      await expect(
        service.getUsageSummaryByTenantId(999),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('consumeCouponQuota', () => {
    it('does the guarded upsert against the limit', async () => {
      const { service, manager, subscriptions } = buildMocks();
      subscriptions.getLimitById.mockResolvedValue(5);
      manager.query.mockResolvedValue([{ used: 3 }]);

      await expect(service.consumeCouponQuota(7)).resolves.toBe(3);

      const [sql, params] = manager.query.mock.calls[0] as [string, unknown[]];
      expect(String(sql)).toContain('ON CONFLICT');
      expect(String(sql)).toContain(
        'WHERE "tenant_usage_counters"."used" < $4',
      );
      expect(params).toEqual([
        7,
        UsageMetric.COUPONS_PER_MONTH,
        currentUtcPeriodStart(),
        5,
      ]);
    });

    it('throws COUPON_MONTHLY_LIMIT_REACHED when no row is returned', async () => {
      const { service, manager, subscriptions } = buildMocks();
      subscriptions.getLimitById.mockResolvedValue(5);
      manager.query.mockResolvedValue([]);

      await expect(service.consumeCouponQuota(7)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      await expect(service.consumeCouponQuota(7)).rejects.toMatchObject({
        response: { code: 'COUPON_MONTHLY_LIMIT_REACHED' },
      });
    });

    it('increments without a guard for unlimited plans', async () => {
      const { service, manager, subscriptions } = buildMocks();
      subscriptions.getLimitById.mockResolvedValue(null);
      manager.query.mockResolvedValue([{ used: 99 }]);

      await expect(service.consumeCouponQuota(7)).resolves.toBe(99);
      const [unlimitedSql] = manager.query.mock.calls[0] as [string];
      expect(String(unlimitedSql)).not.toContain('WHERE');
    });

    it('uses the provided transaction manager', async () => {
      const { service, manager, subscriptions } = buildMocks();
      subscriptions.getLimitById.mockResolvedValue(null);
      const transactionManager = {
        query: jest.fn().mockResolvedValue([{ used: 1 }]),
      };

      await service.consumeCouponQuota(7, transactionManager as never);

      expect(transactionManager.query).toHaveBeenCalled();
      expect(manager.query).not.toHaveBeenCalled();
    });
  });

  it('releases quota with a guarded decrement', async () => {
    const { service, manager } = buildMocks();

    await service.releaseCouponQuota(7);

    const [sql] = manager.query.mock.calls[0] as [string];
    expect(String(sql)).toContain('"used" = "used" - 1');
    expect(String(sql)).toContain('"used" > 0');
  });
});
