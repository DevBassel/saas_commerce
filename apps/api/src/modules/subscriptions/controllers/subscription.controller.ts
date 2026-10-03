import { Controller, Get } from '@nestjs/common';
import { Permissions } from '../../auth/decorators/permissions.decorator';
import { resolveTenantScope } from '../../tenants/utils/tenant-scope';
import { SubscriptionPermissionKey } from '../constants/subscription-permissions.enum';
import { SubscriptionService } from '../services/subscription.service';
import { SubscriptionPlansService } from '../services/subscription-plans.service';
import { SubscriptionUsageService } from '../services/subscription-usage.service';

@Controller('subscription')
@Permissions([SubscriptionPermissionKey.READ])
export class SubscriptionController {
  constructor(
    private readonly subscriptions: SubscriptionService,
    private readonly plans: SubscriptionPlansService,
    private readonly usage: SubscriptionUsageService,
  ) {}

  @Get()
  get() {
    return this.subscriptions.getByTenantRef(resolveTenantScope());
  }

  @Get('plans')
  listPlans() {
    return this.plans.findAll({ active: true, isPublic: true });
  }

  @Get('usage')
  getUsage() {
    return this.usage.getUsageSummary(resolveTenantScope());
  }
}
