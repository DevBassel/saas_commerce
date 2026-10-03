import { BadRequestException, Injectable } from '@nestjs/common';
import { TenantRef } from 'src/modules/tenants/utils/tenant.utils';
import { SubscriptionService } from './subscription.service';
import { SubscriptionUsageService } from './subscription-usage.service';
import { SubscriptionLimitKey } from '../constants/subscription-limit-key.enum';
import { SubscriptionFeatureKey } from '../constants/subscription-feature-key.enum';
import { isSubscriptionUsable } from '../utils/subscription-state';

@Injectable()
export class SubscriptionEntitlementsService {
  constructor(
    private readonly subscriptions: SubscriptionService,
    private readonly usage: SubscriptionUsageService,
  ) {}

  getPlan(ref: TenantRef) {
    return this.subscriptions.getPlanForTenantRef(ref);
  }

  getLimit(ref: TenantRef, key: SubscriptionLimitKey): Promise<number | null> {
    return this.subscriptions.getLimit(ref, key);
  }

  hasFeature(ref: TenantRef, key: SubscriptionFeatureKey): Promise<boolean> {
    return this.subscriptions.hasFeature(ref, key);
  }

  async assertHasFeature(
    ref: TenantRef,
    key: SubscriptionFeatureKey,
  ): Promise<void> {
    if (await this.hasFeature(ref, key)) return;
    throw new BadRequestException({
      code: 'PLAN_FEATURE_NOT_AVAILABLE',
      message: 'Feature not available on the current plan',
    });
  }

  /**
   * Maps a plan limit key to its existing assertion so the error codes stay
   * byte-identical to the service-level path. Each delegate re-runs
   * `assertUsable` itself.
   */
  async assertLimit(ref: TenantRef, key: SubscriptionLimitKey): Promise<void> {
    switch (key) {
      case SubscriptionLimitKey.STORAGE_BYTES:
        return this.assertCanUseStorage(ref);
      case SubscriptionLimitKey.DATABASE_BYTES:
        return this.assertCanUseDatabase(ref);
      case SubscriptionLimitKey.STORE_ADMINS:
        return this.assertCanCreateStoreAdmin(ref);
      case SubscriptionLimitKey.COUPONS_PER_MONTH:
        return this.assertCanCreateCoupon(ref);
      case SubscriptionLimitKey.PRODUCTS:
        return this.assertCanCreateProduct(ref);
    }
  }

  /** A tenant with no subscription row is treated as free and usable. */
  async assertUsable(ref: TenantRef): Promise<void> {
    const { subscription } = await this.subscriptions.getPlanForTenantRef(ref);
    if (subscription && !isSubscriptionUsable(subscription))
      throw new BadRequestException({
        code: 'SUBSCRIPTION_INACTIVE',
        message: 'Subscription is not active',
      });
  }

  async canCreateCoupon(ref: TenantRef): Promise<boolean> {
    const enabled = await this.subscriptions.hasFeature(
      ref,
      SubscriptionFeatureKey.COUPONS,
    );
    if (!enabled) return false;

    const limit = await this.subscriptions.getLimit(
      ref,
      SubscriptionLimitKey.COUPONS_PER_MONTH,
    );
    if (limit == null) return true;

    const used = await this.usage.getMonthlyCouponUsageByRef(ref);
    return used < limit;
  }

  async assertCanCreateCoupon(ref: TenantRef): Promise<void> {
    await this.assertUsable(ref);
    if (await this.canCreateCoupon(ref)) return;
    throw new BadRequestException({
      code: 'COUPON_MONTHLY_LIMIT_REACHED',
      message: 'Monthly coupon limit reached',
    });
  }

  async canCreateStoreAdmin(ref: TenantRef): Promise<boolean> {
    const limit = await this.subscriptions.getLimit(
      ref,
      SubscriptionLimitKey.STORE_ADMINS,
    );
    if (limit == null) return true;

    const used = await this.usage.getStoreAdminUsage(ref);
    return used < limit;
  }

  async assertCanCreateStoreAdmin(ref: TenantRef): Promise<void> {
    await this.assertUsable(ref);
    if (await this.canCreateStoreAdmin(ref)) return;
    throw new BadRequestException({
      code: 'STORE_ADMIN_LIMIT_REACHED',
      message: 'Plan store admin limit reached',
    });
  }

  async canUseStorage(ref: TenantRef): Promise<boolean> {
    const limit = await this.subscriptions.getLimit(
      ref,
      SubscriptionLimitKey.STORAGE_BYTES,
    );
    if (limit == null) return true;

    const used = await this.usage.getStorageUsage(ref);
    return used < limit;
  }

  async assertCanUseStorage(ref: TenantRef): Promise<void> {
    await this.assertUsable(ref);
    if (await this.canUseStorage(ref)) return;
    throw new BadRequestException({
      code: 'STORAGE_LIMIT_REACHED',
      message: 'Plan storage limit reached',
    });
  }

  async canUseDatabase(ref: TenantRef): Promise<boolean> {
    const limit = await this.subscriptions.getLimit(
      ref,
      SubscriptionLimitKey.DATABASE_BYTES,
    );
    if (limit == null) return true;

    const used = await this.usage.getDatabaseUsage(ref);
    return used < limit;
  }

  async assertCanUseDatabase(ref: TenantRef): Promise<void> {
    await this.assertUsable(ref);
    if (await this.canUseDatabase(ref)) return;
    throw new BadRequestException({
      code: 'DATABASE_LIMIT_REACHED',
      message: 'Plan database limit reached',
    });
  }

  async canCreateProduct(ref: TenantRef): Promise<boolean> {
    const limit = await this.subscriptions.getLimit(
      ref,
      SubscriptionLimitKey.PRODUCTS,
    );
    if (limit == null) return true;

    const used = await this.usage.getProductUsage(ref);
    return used < limit;
  }

  async assertCanCreateProduct(ref: TenantRef): Promise<void> {
    await this.assertUsable(ref);
    if (await this.canCreateProduct(ref)) return;
    throw new BadRequestException({
      code: 'PRODUCT_LIMIT_REACHED',
      message: 'Plan product limit reached',
    });
  }
}
