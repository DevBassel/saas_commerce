import { Controller, Get } from '@nestjs/common';
import { Permissions } from '../../auth/decorators/permissions.decorator';
import { resolveTenantScope } from '../../tenants/utils/tenant-scope';
import { SubscriptionPermissionKey } from '../constants/subscription-permissions.enum';
import { SubscriptionService } from '../services/subscription.service';
import { SubscriptionPlansService } from '../services/subscription-plans.service';
import { SubscriptionUsageService } from '../services/subscription-usage.service';
import { CacheResponse } from '../../../common/cache/cache-response.decorator';

@Controller('subscription')
@Permissions([SubscriptionPermissionKey.READ])
export class SubscriptionController {
  constructor(
    private readonly subscriptions: SubscriptionService,
    private readonly plans: SubscriptionPlansService,
    private readonly usage: SubscriptionUsageService,
  ) {}

  @Get()
  async get() {
    const subscription =
      await this.subscriptions.getByTenantRef(resolveTenantScope());
    const refund = await this.subscriptions.getRefundInfo(subscription);
    return subscription ? { ...subscription, ...refund } : null;
  }

  @Get('plans')
  @CacheResponse({ policy: 'plans', scope: 'platform' })
  listPlans() {
    return this.plans.findAll({ active: true, isPublic: true });
  }

  @Get('usage')
  getUsage() {
    return this.usage.getUsageSummary(resolveTenantScope());
  }
}
