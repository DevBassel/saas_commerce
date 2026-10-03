import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TenantModule } from '../tenants/tenant.module';
import { SubscriptionPlan } from './entities/subscription-plan.entity';
import { SubscriptionPlanLimit } from './entities/subscription-plan-limit.entity';
import { SubscriptionPlanFeature } from './entities/subscription-plan-feature.entity';
import { Subscription } from './entities/subscription.entity';
import { TenantUsageCounter } from './entities/tenant-usage-counter.entity';
import { SubscriptionPlansService } from './services/subscription-plans.service';
import { SubscriptionService } from './services/subscription.service';
import { SubscriptionUsageService } from './services/subscription-usage.service';
import { SubscriptionEntitlementsService } from './services/subscription-entitlements.service';
import { PlatformSubscriptionPlansController } from './controllers/platform-subscription-plans.controller';
import { PlatformTenantSubscriptionController } from './controllers/platform-tenant-subscription.controller';
import { SubscriptionController } from './controllers/subscription.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SubscriptionPlan,
      SubscriptionPlanLimit,
      SubscriptionPlanFeature,
      Subscription,
      TenantUsageCounter,
    ]),
    TenantModule,
  ],
  controllers: [
    PlatformSubscriptionPlansController,
    PlatformTenantSubscriptionController,
    SubscriptionController,
  ],
  providers: [
    SubscriptionPlansService,
    SubscriptionService,
    SubscriptionUsageService,
    SubscriptionEntitlementsService,
  ],
  exports: [
    SubscriptionPlansService,
    SubscriptionService,
    SubscriptionUsageService,
    SubscriptionEntitlementsService,
  ],
})
export class SubscriptionsModule {}
