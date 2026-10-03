import { BadRequestException, ExecutionContext } from '@nestjs/common';
import { SubscriptionGuard } from './subscription.guard';
import { IS_PUBLIC } from 'src/modules/auth/decorators/isPublic.decorator';
import { IS_PLATFORM } from 'src/modules/auth/decorators/isPlatform.decorator';
import {
  REQUIRE_ACTIVE_SUBSCRIPTION,
  RequireSubscriptionFeature,
  RequireSubscriptionLimit,
} from '../decorators/subscription.decorators';
import { SubscriptionFeatureKey } from '../constants/subscription-feature-key.enum';
import { SubscriptionLimitKey } from '../constants/subscription-limit-key.enum';

const TENANT = { id: 7, schemaName: 'tenant_test' };

interface Meta {
  isPublic?: boolean;
  isPlatform?: boolean;
  active?: boolean;
  features?: SubscriptionFeatureKey[];
  limits?: SubscriptionLimitKey[];
}

const buildGuard = (meta: Meta, tenant?: object) => {
  const reflector = {
    getAllAndOverride: jest.fn((key: unknown) => {
      if (key === IS_PUBLIC) return meta.isPublic;
      if (key === IS_PLATFORM) return meta.isPlatform;
      if (key === REQUIRE_ACTIVE_SUBSCRIPTION) return meta.active;
      if (key === RequireSubscriptionFeature) return meta.features;
      if (key === RequireSubscriptionLimit) return meta.limits;
      return undefined;
    }),
  };
  const entitlements = {
    assertUsable: jest.fn().mockResolvedValue(undefined),
    assertHasFeature: jest.fn().mockResolvedValue(undefined),
    assertLimit: jest.fn().mockResolvedValue(undefined),
  };
  const guard = new SubscriptionGuard(
    reflector as never,
    entitlements as never,
  );
  const context = {
    getHandler: () => ({}),
    getClass: () => ({}) as never,
    switchToHttp: () => ({ getRequest: () => ({ tenant }) }),
  } as unknown as ExecutionContext;
  return { guard, context, entitlements };
};

describe('SubscriptionGuard', () => {
  it('passes @Public routes without touching entitlements', async () => {
    const { guard, context, entitlements } = buildGuard({
      isPublic: true,
      active: true,
      features: [SubscriptionFeatureKey.COUPONS],
    });
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(entitlements.assertUsable).not.toHaveBeenCalled();
    expect(entitlements.assertHasFeature).not.toHaveBeenCalled();
  });

  it('passes @Platform routes without touching entitlements', async () => {
    const { guard, context, entitlements } = buildGuard({
      isPlatform: true,
      active: true,
      limits: [SubscriptionLimitKey.DATABASE_BYTES],
    });
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(entitlements.assertUsable).not.toHaveBeenCalled();
    expect(entitlements.assertLimit).not.toHaveBeenCalled();
  });

  it('passes routes without entitlement metadata', async () => {
    const { guard, context, entitlements } = buildGuard({});
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(entitlements.assertUsable).not.toHaveBeenCalled();
    expect(entitlements.assertHasFeature).not.toHaveBeenCalled();
    expect(entitlements.assertLimit).not.toHaveBeenCalled();
  });

  it('asserts usability with the request tenant ref when active is required', async () => {
    const { guard, context, entitlements } = buildGuard(
      { active: true },
      TENANT,
    );
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(entitlements.assertUsable).toHaveBeenCalledWith(TENANT);
  });

  it('asserts each required feature', async () => {
    const { guard, context, entitlements } = buildGuard(
      { features: [SubscriptionFeatureKey.COUPONS] },
      TENANT,
    );
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(entitlements.assertHasFeature).toHaveBeenCalledWith(
      TENANT,
      SubscriptionFeatureKey.COUPONS,
    );
  });

  it('propagates a PLAN_FEATURE_NOT_AVAILABLE rejection', async () => {
    const { guard, context, entitlements } = buildGuard(
      { features: [SubscriptionFeatureKey.COUPONS] },
      TENANT,
    );
    entitlements.assertHasFeature.mockRejectedValueOnce(
      new BadRequestException({
        code: 'PLAN_FEATURE_NOT_AVAILABLE',
        message: 'Feature not available on the current plan',
      }),
    );
    await expect(guard.canActivate(context)).rejects.toMatchObject({
      response: { code: 'PLAN_FEATURE_NOT_AVAILABLE' },
    });
  });

  it('asserts each required limit', async () => {
    const { guard, context, entitlements } = buildGuard(
      { limits: [SubscriptionLimitKey.DATABASE_BYTES] },
      TENANT,
    );
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(entitlements.assertLimit).toHaveBeenCalledWith(
      TENANT,
      SubscriptionLimitKey.DATABASE_BYTES,
    );
  });

  it('rejects a gated route when the tenant context is missing', async () => {
    const { guard, context } = buildGuard({ active: true });
    await expect(guard.canActivate(context)).rejects.toMatchObject({
      status: 403,
    });
  });
});
