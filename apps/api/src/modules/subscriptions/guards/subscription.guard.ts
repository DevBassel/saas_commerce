import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RequestWithUser } from 'src/modules/auth/interfaces/RequestWithUser.interface';
import { IS_PUBLIC } from 'src/modules/auth/decorators/isPublic.decorator';
import { IS_PLATFORM } from 'src/modules/auth/decorators/isPlatform.decorator';
import { resolveTenantScope } from 'src/modules/tenants/utils/tenant-scope';
import { SubscriptionEntitlementsService } from '../services/subscription-entitlements.service';
import {
  REQUIRE_ACTIVE_SUBSCRIPTION,
  RequireSubscriptionFeature,
  RequireSubscriptionLimit,
} from '../decorators/subscription.decorators';
import { SubscriptionFeatureKey } from '../constants/subscription-feature-key.enum';
import { SubscriptionLimitKey } from '../constants/subscription-limit-key.enum';

/**
 * Early HTTP-layer gate for tenant subscription entitlements. It coexists with
 * the service-level `SubscriptionEntitlementsService` checks, which stay
 * authoritative (atomic coupon consumption, target-role and file-size logic).
 *
 * Opt-in: a route is gated only when annotated with `@RequireActiveSubscription`,
 * `@RequireSubscriptionFeature` or `@RequireSubscriptionLimit`. `@Public` and
 * `@Platform` routes always pass.
 */
@Injectable()
export class SubscriptionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly entitlements: SubscriptionEntitlementsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const isPlatform = this.reflector.getAllAndOverride<boolean>(IS_PLATFORM, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPlatform) return true;

    const targets = [context.getHandler(), context.getClass()];

    const requiresActive = this.reflector.getAllAndOverride<boolean>(
      REQUIRE_ACTIVE_SUBSCRIPTION,
      targets,
    );
    const features = this.reflector.getAllAndOverride<SubscriptionFeatureKey[]>(
      RequireSubscriptionFeature,
      targets,
    );
    const limits = this.reflector.getAllAndOverride<SubscriptionLimitKey[]>(
      RequireSubscriptionLimit,
      targets,
    );

    if (!requiresActive && !features?.length && !limits?.length) return true;

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const ref = resolveTenantScope(request.tenant);

    if (requiresActive) await this.entitlements.assertUsable(ref);

    for (const feature of features ?? []) {
      await this.entitlements.assertHasFeature(ref, feature);
    }

    for (const limit of limits ?? []) {
      await this.entitlements.assertLimit(ref, limit);
    }

    return true;
  }
}
