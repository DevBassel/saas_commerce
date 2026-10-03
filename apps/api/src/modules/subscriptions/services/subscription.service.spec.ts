import { NotFoundException } from '@nestjs/common';
import { SubscriptionService } from './subscription.service';
import { Subscription } from '../entities/subscription.entity';
import { SubscriptionPlan } from '../entities/subscription-plan.entity';
import { SubscriptionLimitKey } from '../constants/subscription-limit-key.enum';
import { SubscriptionFeatureKey } from '../constants/subscription-feature-key.enum';
import { SubscriptionStatus } from '../constants/subscription-status.enum';
import { BillingInterval } from '../constants/billing-interval.enum';
import { LimitValueType } from '../constants/limit-value-type.enum';
import { UNLIMITED_STORAGE_BYTES } from '../constants/subscription.constants';

const NOW = new Date('2026-01-01T00:00:00.000Z');

const plan = (overrides: Record<string, unknown> = {}): SubscriptionPlan =>
  ({
    id: 2,
    slug: 'free',
    name: 'Free',
    active: true,
    isPublic: true,
    trialDays: 0,
    limits: [],
    features: [],
    ...overrides,
  }) as unknown as SubscriptionPlan;

const subscription = (overrides: Record<string, unknown> = {}): Subscription =>
  ({
    id: 1,
    tenantId: 7,
    planId: 2,
    status: SubscriptionStatus.ACTIVE,
    billingInterval: BillingInterval.MONTHLY,
    currentPeriodEnd: null,
    ...overrides,
  }) as unknown as Subscription;

const buildMocks = () => {
  const subscriptionRepo = {
    findOne: jest.fn(),
    findOneBy: jest.fn().mockResolvedValue(null),
    create: jest.fn((data: unknown) => data),
    save: jest.fn((data: Record<string, unknown>) => ({
      id: 1,
      createdAt: NOW,
      updatedAt: NOW,
      ...data,
    })),
    update: jest.fn().mockResolvedValue(undefined),
  };
  const planRepo = {
    findOne: jest.fn(),
    findOneBy: jest.fn(),
  };
  const manager = {
    findOne: jest.fn().mockResolvedValue(subscription()),
    query: jest.fn(),
  };
  const dataSource = {
    transaction: jest.fn((cb: (m: unknown) => unknown) => cb(manager)),
    manager,
  };
  const tenantService = {
    findBySchemaName: jest.fn(),
    setStorageCapacity: jest.fn().mockResolvedValue(undefined),
  };

  const service = new SubscriptionService(
    subscriptionRepo as never,
    planRepo as never,
    dataSource as never,
    tenantService as never,
  );

  return {
    service,
    subscriptionRepo,
    planRepo,
    dataSource,
    manager,
    tenantService,
  };
};

describe('SubscriptionService', () => {
  describe('lookups', () => {
    it('loads a subscription with its plan relations', async () => {
      const { service, subscriptionRepo } = buildMocks();
      const row = subscription({ plan: plan() });
      subscriptionRepo.findOne.mockResolvedValue(row);

      await expect(service.getByTenantId(7)).resolves.toBe(row);
      expect(subscriptionRepo.findOne).toHaveBeenCalledWith({
        where: { tenantId: 7 },
        relations: { plan: { limits: true, features: true } },
      });
    });

    it('resolves a tenant ref to its id', async () => {
      const { service, tenantService, subscriptionRepo } = buildMocks();
      tenantService.findBySchemaName.mockResolvedValue({ id: 7 });
      subscriptionRepo.findOne.mockResolvedValue(subscription());

      await service.getByTenantRef({ schemaName: 'tenant_a' });

      expect(tenantService.findBySchemaName).toHaveBeenCalledWith('tenant_a');
      expect(subscriptionRepo.findOne).toHaveBeenCalledWith(
        expect.objectContaining({ where: { tenantId: 7 } }),
      );
    });

    it('falls back to the free plan when there is no subscription', async () => {
      const { service, subscriptionRepo, planRepo } = buildMocks();
      subscriptionRepo.findOne.mockResolvedValue(null);
      planRepo.findOne.mockResolvedValue(plan());

      const result = await service.getPlanForTenantId(7);

      expect(result.subscription).toBeNull();
      expect(result.plan?.slug).toBe('free');
    });

    it('reads a limit and treats null/absent rows as unlimited', async () => {
      const { service, subscriptionRepo, planRepo } = buildMocks();
      subscriptionRepo.findOne.mockResolvedValue(
        subscription({
          plan: plan({
            limits: [
              {
                key: SubscriptionLimitKey.STORE_ADMINS,
                value: 3,
                type: LimitValueType.COUNT,
              },
              {
                key: SubscriptionLimitKey.STORAGE_BYTES,
                value: null,
                type: LimitValueType.BYTES,
              },
            ],
          }),
        }),
      );

      await expect(
        service.getLimitById(7, SubscriptionLimitKey.STORE_ADMINS),
      ).resolves.toBe(3);
      await expect(
        service.getLimitById(7, SubscriptionLimitKey.STORAGE_BYTES),
      ).resolves.toBeNull();
      await expect(
        service.getLimitById(7, SubscriptionLimitKey.DATABASE_BYTES),
      ).resolves.toBeNull();
      expect(planRepo.findOne).not.toHaveBeenCalled();
    });

    it('checks features', async () => {
      const { service, subscriptionRepo } = buildMocks();
      subscriptionRepo.findOne.mockResolvedValue(
        subscription({
          plan: plan({
            features: [
              { key: SubscriptionFeatureKey.COUPONS, enabled: true },
              { key: SubscriptionFeatureKey.AUDIT_LOGS, enabled: false },
            ],
          }),
        }),
      );

      await expect(
        service.hasFeatureById(7, SubscriptionFeatureKey.COUPONS),
      ).resolves.toBe(true);
      await expect(
        service.hasFeatureById(7, SubscriptionFeatureKey.AUDIT_LOGS),
      ).resolves.toBe(false);
    });
  });

  describe('assignPlan', () => {
    it('rejects a missing plan', async () => {
      const { service, planRepo } = buildMocks();
      planRepo.findOne.mockResolvedValue(null);

      await expect(
        service.assignPlan(7, { planId: 99 }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('rejects an inactive plan', async () => {
      const { service, planRepo } = buildMocks();
      planRepo.findOne.mockResolvedValue(plan({ active: false }));

      await expect(service.assignPlan(7, { planId: 2 })).rejects.toMatchObject({
        response: { code: 'PLAN_INACTIVE' },
      });
    });

    it('rejects assigning a private plan to a new tenant', async () => {
      const { service, planRepo, subscriptionRepo } = buildMocks();
      planRepo.findOne.mockResolvedValue(plan({ isPublic: false }));
      subscriptionRepo.findOneBy.mockResolvedValue(null);

      await expect(service.assignPlan(7, { planId: 2 })).rejects.toMatchObject({
        response: { code: 'PLAN_NOT_PUBLIC' },
      });
    });

    it('syncs Tenant.storageCapacityBytes from STORAGE_BYTES', async () => {
      const { service, planRepo, subscriptionRepo, tenantService } =
        buildMocks();
      planRepo.findOne.mockResolvedValue(
        plan({
          limits: [
            {
              key: SubscriptionLimitKey.STORAGE_BYTES,
              value: 500,
              type: LimitValueType.BYTES,
            },
          ],
        }),
      );
      subscriptionRepo.findOneBy.mockResolvedValue(null);
      subscriptionRepo.findOne.mockResolvedValue(subscription());

      await service.assignPlan(7, { planId: 2 });

      expect(tenantService.setStorageCapacity).toHaveBeenCalledWith(7, 500n);
    });

    it('uses the unlimited sentinel when the plan has no STORAGE_BYTES row', async () => {
      const { service, planRepo, subscriptionRepo, tenantService } =
        buildMocks();
      planRepo.findOne.mockResolvedValue(plan({ limits: [] }));
      subscriptionRepo.findOneBy.mockResolvedValue(null);
      subscriptionRepo.findOne.mockResolvedValue(subscription());

      await service.assignPlan(7, { planId: 2 });

      expect(tenantService.setStorageCapacity).toHaveBeenCalledWith(
        7,
        UNLIMITED_STORAGE_BYTES,
      );
    });

    it('starts a trial for a new plan with trialDays', async () => {
      const { service, planRepo, subscriptionRepo, tenantService } =
        buildMocks();
      planRepo.findOne.mockResolvedValue(plan({ trialDays: 14, limits: [] }));
      subscriptionRepo.findOneBy.mockResolvedValue(null);
      subscriptionRepo.findOne.mockResolvedValue(subscription());

      await service.assignPlan(7, { planId: 2 });

      const saveArgs = subscriptionRepo.save.mock.calls as unknown[][];
      const saved = saveArgs[0][0] as Subscription;
      expect(saved.status).toBe(SubscriptionStatus.TRIALING);
      expect(saved.trialStart).toBeDefined();
      expect(saved.trialEnd).toBeDefined();
      expect(tenantService.setStorageCapacity).toHaveBeenCalled();
    });
  });

  describe('updateStatus', () => {
    it('throws when the tenant has no subscription', async () => {
      const { service, subscriptionRepo } = buildMocks();
      subscriptionRepo.findOneBy.mockResolvedValue(null);

      await expect(
        service.updateStatus(7, SubscriptionStatus.CANCELED),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('stamps canceledAt when cancelling', async () => {
      const { service, subscriptionRepo } = buildMocks();
      subscriptionRepo.findOneBy.mockResolvedValue(subscription());
      subscriptionRepo.findOne.mockResolvedValue(
        subscription({ status: SubscriptionStatus.CANCELED }),
      );

      await service.updateStatus(7, SubscriptionStatus.CANCELED);

      const updateArgs = subscriptionRepo.update.mock.calls as unknown[][];
      const patch = updateArgs[0][1] as {
        status: SubscriptionStatus;
        canceledAt: Date;
      };
      expect(patch.status).toBe(SubscriptionStatus.CANCELED);
      expect(patch.canceledAt).toBeInstanceOf(Date);
    });
  });

  describe('ensureFreeSubscription', () => {
    it('does nothing when a subscription already exists', async () => {
      const { service, subscriptionRepo, planRepo } = buildMocks();
      subscriptionRepo.findOneBy.mockResolvedValue(subscription());

      const result = await service.ensureFreeSubscription({ id: 7 } as never);

      expect(result).not.toBeNull();
      expect(planRepo.findOneBy).not.toHaveBeenCalled();
    });

    it('assigns the free plan when missing', async () => {
      const { service, subscriptionRepo, planRepo } = buildMocks();
      subscriptionRepo.findOneBy.mockResolvedValue(null);
      planRepo.findOneBy.mockResolvedValue(plan({ id: 2 }));
      planRepo.findOne.mockResolvedValue(plan({ id: 2 }));
      subscriptionRepo.findOne.mockResolvedValue(subscription());

      await service.ensureFreeSubscription({ id: 7 } as never);

      expect(planRepo.findOneBy).toHaveBeenCalledWith({ slug: 'free' });
      expect(subscriptionRepo.save).toHaveBeenCalled();
    });
  });

  describe('withTenantLock', () => {
    it('locks the subscription row inside a public transaction', async () => {
      const { service, manager, dataSource } = buildMocks();
      const fn = jest.fn().mockResolvedValue('done');

      await expect(service.withTenantLock(7, fn)).resolves.toBe('done');

      expect(dataSource.transaction).toHaveBeenCalled();
      expect(manager.findOne).toHaveBeenCalledWith(Subscription, {
        where: { tenantId: 7 },
        lock: { mode: 'pessimistic_write' },
      });
      expect(fn).toHaveBeenCalledWith(manager);
    });
  });
});
