import { BadRequestException } from '@nestjs/common';
import { SubscriptionEntitlementsService } from './subscription-entitlements.service';
import { SubscriptionLimitKey } from '../constants/subscription-limit-key.enum';
import { SubscriptionFeatureKey } from '../constants/subscription-feature-key.enum';
import { SubscriptionStatus } from '../constants/subscription-status.enum';

const TENANT = { schemaName: 'tenant_test' };

const buildMocks = () => {
  const subscriptions = {
    getPlanForTenantRef: jest.fn().mockResolvedValue({
      plan: null,
      subscription: null,
    }),
    getLimit: jest.fn().mockResolvedValue(null),
    hasFeature: jest.fn().mockResolvedValue(true),
  };
  const usage = {
    getMonthlyCouponUsageByRef: jest.fn().mockResolvedValue(0),
    getStoreAdminUsage: jest.fn().mockResolvedValue(0),
    getStorageUsage: jest.fn().mockResolvedValue(0),
    getDatabaseUsage: jest.fn().mockResolvedValue(0),
    getProductUsage: jest.fn().mockResolvedValue(0),
  };
  const service = new SubscriptionEntitlementsService(
    subscriptions as never,
    usage as never,
  );
  return { service, subscriptions, usage };
};

describe('SubscriptionEntitlementsService', () => {
  it('delegates getLimit and hasFeature', async () => {
    const { service, subscriptions } = buildMocks();
    subscriptions.getLimit.mockResolvedValue(10);
    subscriptions.hasFeature.mockResolvedValue(true);

    await expect(
      service.getLimit(TENANT, SubscriptionLimitKey.STORE_ADMINS),
    ).resolves.toBe(10);
    await expect(
      service.hasFeature(TENANT, SubscriptionFeatureKey.COUPONS),
    ).resolves.toBe(true);
  });

  describe('coupons', () => {
    it('allows when the feature is on and the limit is unlimited', async () => {
      const { service, subscriptions } = buildMocks();
      subscriptions.hasFeature.mockResolvedValue(true);
      subscriptions.getLimit.mockResolvedValue(null);

      await expect(service.canCreateCoupon(TENANT)).resolves.toBe(true);
    });

    it('rejects when the feature is off', async () => {
      const { service, subscriptions } = buildMocks();
      subscriptions.hasFeature.mockResolvedValue(false);

      await expect(service.canCreateCoupon(TENANT)).resolves.toBe(false);
    });

    it('rejects once used reaches the limit', async () => {
      const { service, subscriptions, usage } = buildMocks();
      subscriptions.getLimit.mockResolvedValue(5);
      usage.getMonthlyCouponUsageByRef.mockResolvedValue(5);

      await expect(service.canCreateCoupon(TENANT)).resolves.toBe(false);
      await expect(service.assertCanCreateCoupon(TENANT)).rejects.toMatchObject(
        { response: { code: 'COUPON_MONTHLY_LIMIT_REACHED' } },
      );
    });
  });

  describe('store admins', () => {
    it('counts the owner: rejects when used reaches the limit', async () => {
      const { service, subscriptions, usage } = buildMocks();
      subscriptions.getLimit.mockResolvedValue(1);
      usage.getStoreAdminUsage.mockResolvedValue(1);

      await expect(service.canCreateStoreAdmin(TENANT)).resolves.toBe(false);
      await expect(
        service.assertCanCreateStoreAdmin(TENANT),
      ).rejects.toMatchObject({
        response: { code: 'STORE_ADMIN_LIMIT_REACHED' },
      });
    });

    it('allows unlimited plans', async () => {
      const { service, subscriptions, usage } = buildMocks();
      subscriptions.getLimit.mockResolvedValue(null);

      await expect(service.canCreateStoreAdmin(TENANT)).resolves.toBe(true);
      expect(usage.getStoreAdminUsage).not.toHaveBeenCalled();
    });
  });

  describe('storage and database', () => {
    it('gates storage usage', async () => {
      const { service, subscriptions, usage } = buildMocks();
      subscriptions.getLimit.mockResolvedValue(100);
      usage.getStorageUsage.mockResolvedValue(100);

      await expect(service.canUseStorage(TENANT)).resolves.toBe(false);
      await expect(service.assertCanUseStorage(TENANT)).rejects.toMatchObject({
        response: { code: 'STORAGE_LIMIT_REACHED' },
      });
    });

    it('gates database usage', async () => {
      const { service, subscriptions, usage } = buildMocks();
      subscriptions.getLimit.mockResolvedValue(100);
      usage.getDatabaseUsage.mockResolvedValue(101);

      await expect(service.canUseDatabase(TENANT)).resolves.toBe(false);
      await expect(service.assertCanUseDatabase(TENANT)).rejects.toMatchObject({
        response: { code: 'DATABASE_LIMIT_REACHED' },
      });
    });
  });

  describe('assertHasFeature', () => {
    it('resolves when the feature is enabled', async () => {
      const { service, subscriptions } = buildMocks();
      subscriptions.hasFeature.mockResolvedValue(true);

      await expect(
        service.assertHasFeature(TENANT, SubscriptionFeatureKey.COUPONS),
      ).resolves.toBeUndefined();
    });

    it('rejects with PLAN_FEATURE_NOT_AVAILABLE when disabled', async () => {
      const { service, subscriptions } = buildMocks();
      subscriptions.hasFeature.mockResolvedValue(false);

      await expect(
        service.assertHasFeature(TENANT, SubscriptionFeatureKey.COUPONS),
      ).rejects.toMatchObject({
        response: { code: 'PLAN_FEATURE_NOT_AVAILABLE' },
      });
    });
  });

  describe('assertLimit', () => {
    it('maps STORAGE_BYTES to assertCanUseStorage', async () => {
      const { service } = buildMocks();
      const spy = jest
        .spyOn(service, 'assertCanUseStorage')
        .mockResolvedValue(undefined);

      await service.assertLimit(TENANT, SubscriptionLimitKey.STORAGE_BYTES);

      expect(spy).toHaveBeenCalledWith(TENANT);
    });

    it('maps DATABASE_BYTES to assertCanUseDatabase', async () => {
      const { service } = buildMocks();
      const spy = jest
        .spyOn(service, 'assertCanUseDatabase')
        .mockResolvedValue(undefined);

      await service.assertLimit(TENANT, SubscriptionLimitKey.DATABASE_BYTES);

      expect(spy).toHaveBeenCalledWith(TENANT);
    });

    it('maps STORE_ADMINS to assertCanCreateStoreAdmin', async () => {
      const { service } = buildMocks();
      const spy = jest
        .spyOn(service, 'assertCanCreateStoreAdmin')
        .mockResolvedValue(undefined);

      await service.assertLimit(TENANT, SubscriptionLimitKey.STORE_ADMINS);

      expect(spy).toHaveBeenCalledWith(TENANT);
    });

    it('maps COUPONS_PER_MONTH to assertCanCreateCoupon', async () => {
      const { service } = buildMocks();
      const spy = jest
        .spyOn(service, 'assertCanCreateCoupon')
        .mockResolvedValue(undefined);

      await service.assertLimit(TENANT, SubscriptionLimitKey.COUPONS_PER_MONTH);

      expect(spy).toHaveBeenCalledWith(TENANT);
    });

    it('maps PRODUCTS to assertCanCreateProduct', async () => {
      const { service } = buildMocks();
      const spy = jest
        .spyOn(service, 'assertCanCreateProduct')
        .mockResolvedValue(undefined);

      await service.assertLimit(TENANT, SubscriptionLimitKey.PRODUCTS);

      expect(spy).toHaveBeenCalledWith(TENANT);
    });
  });

  describe('products', () => {
    it('allows when the plan has no product limit', async () => {
      const { service, subscriptions, usage } = buildMocks();

      await expect(service.canCreateProduct(TENANT)).resolves.toBe(true);
      expect(subscriptions.getLimit).toHaveBeenCalledWith(
        TENANT,
        SubscriptionLimitKey.PRODUCTS,
      );
      expect(usage.getProductUsage).not.toHaveBeenCalled();
    });

    it('rejects with PRODUCT_LIMIT_REACHED once used reaches the limit', async () => {
      const { service, subscriptions, usage } = buildMocks();
      subscriptions.getLimit.mockResolvedValue(10);
      usage.getProductUsage.mockResolvedValue(10);

      await expect(service.canCreateProduct(TENANT)).resolves.toBe(false);
      await expect(
        service.assertCanCreateProduct(TENANT),
      ).rejects.toMatchObject({
        response: { code: 'PRODUCT_LIMIT_REACHED' },
      });
    });
  });

  describe('assertUsable', () => {
    it('passes when there is no subscription row', async () => {
      const { service } = buildMocks();
      await expect(service.assertUsable(TENANT)).resolves.toBeUndefined();
    });

    it('rejects a non-usable subscription', async () => {
      const { service, subscriptions } = buildMocks();
      subscriptions.getPlanForTenantRef.mockResolvedValue({
        plan: null,
        subscription: {
          status: SubscriptionStatus.CANCELED,
          currentPeriodEnd: new Date('2000-01-01T00:00:00.000Z'),
        },
      });

      await expect(service.assertUsable(TENANT)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });
  });
});
