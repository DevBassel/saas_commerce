import { BadRequestException, NotFoundException } from '@nestjs/common';
import { SubscriptionPlansService } from './subscription-plans.service';
import { SubscriptionPlan } from '../entities/subscription-plan.entity';
import { SubscriptionPlanLimit } from '../entities/subscription-plan-limit.entity';
import { SubscriptionPlanFeature } from '../entities/subscription-plan-feature.entity';
import { Subscription } from '../entities/subscription.entity';
import { SubscriptionLimitKey } from '../constants/subscription-limit-key.enum';
import { SubscriptionFeatureKey } from '../constants/subscription-feature-key.enum';
import { LimitValueType } from '../constants/limit-value-type.enum';

const NOW = new Date('2026-01-01T00:00:00.000Z');

const plan = (overrides: Record<string, unknown> = {}): SubscriptionPlan =>
  ({
    id: 1,
    name: 'Free',
    slug: 'free',
    description: null,
    monthlyPrice: 0,
    yearlyPrice: 0,
    currency: 'usd',
    active: true,
    isPublic: true,
    sortOrder: 0,
    trialDays: 0,
    limits: [],
    features: [],
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  }) as unknown as SubscriptionPlan;

const buildMocks = () => {
  const planRepo = {
    findOneBy: jest.fn().mockResolvedValue(null),
    findOne: jest.fn(),
    find: jest.fn().mockResolvedValue([]),
    create: jest.fn((data: unknown) => data),
    save: jest.fn((data: Record<string, unknown>) => ({
      id: 1,
      createdAt: NOW,
      updatedAt: NOW,
      ...data,
    })),
    update: jest.fn().mockResolvedValue(undefined),
    delete: jest.fn().mockResolvedValue(undefined),
  };
  const limitRepo = {
    delete: jest.fn().mockResolvedValue(undefined),
    insert: jest.fn().mockResolvedValue(undefined),
    find: jest.fn().mockResolvedValue([]),
    create: jest.fn((data: unknown) => data),
    update: jest.fn().mockResolvedValue(undefined),
  };
  const featureRepo = {
    delete: jest.fn().mockResolvedValue(undefined),
    insert: jest.fn().mockResolvedValue(undefined),
    find: jest.fn().mockResolvedValue([]),
    create: jest.fn((data: unknown) => data),
    update: jest.fn().mockResolvedValue(undefined),
  };
  const subscriptionRepo = {
    count: jest.fn().mockResolvedValue(0),
  };

  const service = new SubscriptionPlansService(
    planRepo as never,
    limitRepo as never,
    featureRepo as never,
    subscriptionRepo as never,
  );

  return { service, planRepo, limitRepo, featureRepo, subscriptionRepo };
};

describe('SubscriptionPlansService', () => {
  describe('create', () => {
    it('creates a plan and its limits/features', async () => {
      const { service, planRepo, limitRepo, featureRepo } = buildMocks();
      planRepo.findOne.mockResolvedValue(plan());

      const result = await service.create({
        name: 'Free',
        slug: 'free',
        limits: [
          {
            key: SubscriptionLimitKey.STORE_ADMINS,
            value: 1,
            type: LimitValueType.COUNT,
          },
        ],
        features: [{ key: SubscriptionFeatureKey.COUPONS }],
      });

      expect(planRepo.save).toHaveBeenCalled();
      expect(limitRepo.delete).toHaveBeenCalledWith({ planId: 1 });
      expect(limitRepo.insert).toHaveBeenCalledTimes(1);
      expect(featureRepo.insert).toHaveBeenCalledTimes(1);
      expect(result).toBeDefined();
    });

    it('rejects a duplicate slug', async () => {
      const { service, planRepo } = buildMocks();
      planRepo.findOneBy.mockResolvedValue(plan());

      await expect(
        service.create({ name: 'Free', slug: 'free' }),
      ).rejects.toMatchObject({ response: { code: 'PLAN_SLUG_TAKEN' } });
    });

    it('rejects an unknown limit key', async () => {
      const { service } = buildMocks();

      await expect(
        service.create({
          name: 'Free',
          slug: 'free',
          limits: [
            {
              key: 'NOPE' as SubscriptionLimitKey,
              value: 1,
              type: LimitValueType.COUNT,
            },
          ],
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects an unknown feature key', async () => {
      const { service } = buildMocks();

      await expect(
        service.create({
          name: 'Free',
          slug: 'free',
          features: [{ key: 'NOPE' as SubscriptionFeatureKey }],
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects a negative limit value', async () => {
      const { service } = buildMocks();

      await expect(
        service.create({
          name: 'Free',
          slug: 'free',
          limits: [
            {
              key: SubscriptionLimitKey.STORE_ADMINS,
              value: -1,
              type: LimitValueType.COUNT,
            },
          ],
        }),
      ).rejects.toMatchObject({ response: { code: 'INVALID_LIMIT_VALUE' } });
    });
  });

  describe('findOne', () => {
    it('throws PLAN_NOT_FOUND', async () => {
      const { service, planRepo } = buildMocks();
      planRepo.findOne.mockResolvedValue(null);

      await expect(service.findOne(9)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('replaces limits when provided', async () => {
      const { service, planRepo, limitRepo } = buildMocks();
      planRepo.findOneBy.mockResolvedValue(plan());
      planRepo.findOne.mockResolvedValue(plan());

      await service.update(1, {
        limits: [
          {
            key: SubscriptionLimitKey.STORAGE_BYTES,
            value: 10,
            type: LimitValueType.BYTES,
          },
        ],
      });

      expect(limitRepo.delete).toHaveBeenCalledWith({ planId: 1 });
      expect(limitRepo.insert).toHaveBeenCalledTimes(1);
    });
  });

  describe('remove', () => {
    it('deactivates a plan that tenants still reference', async () => {
      const { service, planRepo, subscriptionRepo } = buildMocks();
      planRepo.findOneBy.mockResolvedValue(plan());
      subscriptionRepo.count.mockResolvedValue(3);

      const result = await service.remove(1);

      expect(result).toEqual({ deactivated: true });
      expect(planRepo.update).toHaveBeenCalledWith(
        { id: 1 },
        { active: false },
      );
      expect(planRepo.delete).not.toHaveBeenCalled();
    });

    it('hard-deletes an unreferenced plan', async () => {
      const { service, planRepo, subscriptionRepo } = buildMocks();
      planRepo.findOneBy.mockResolvedValue(plan());
      subscriptionRepo.count.mockResolvedValue(0);

      const result = await service.remove(1);

      expect(result).toEqual({ deleted: true });
      expect(planRepo.delete).toHaveBeenCalledWith({ id: 1 });
    });
  });

  it('does not confuse the limit and feature repository types', async () => {
    const { service, planRepo, limitRepo } = buildMocks();
    planRepo.findOneBy.mockResolvedValue(null);
    planRepo.findOne.mockResolvedValue(plan());

    await service.create({
      name: 'X',
      slug: 'x',
      limits: [
        {
          key: SubscriptionLimitKey.COUPONS_PER_MONTH,
          value: null,
          type: LimitValueType.COUNT,
        },
      ],
    });

    const insertArgs = limitRepo.insert.mock.calls as unknown[][];
    const inserted = (insertArgs[0][0] as SubscriptionPlanLimit[])[0];
    expect(inserted.value).toBeNull();
    expect(SubscriptionPlanFeature).toBeDefined();
    expect(Subscription).toBeDefined();
  });
});
