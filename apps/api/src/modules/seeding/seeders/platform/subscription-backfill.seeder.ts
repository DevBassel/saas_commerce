import { Injectable, Logger } from '@nestjs/common';
import { TenantService } from 'src/modules/tenants/tenant.service';
import { SubscriptionService } from 'src/modules/subscriptions/services/subscription.service';
import { SeederOrder } from '../../constants/seeding.constants';
import { PlatformSeeder } from '../../interfaces/seeder.interface';

@Injectable()
export class SubscriptionBackfillSeeder implements PlatformSeeder {
  readonly name = 'subscription-backfill';
  readonly order = SeederOrder.SUBSCRIPTION_BACKFILL;

  private readonly logger = new Logger(SubscriptionBackfillSeeder.name);

  constructor(
    private readonly tenantService: TenantService,
    private readonly subscriptions: SubscriptionService,
  ) {}

  async run(): Promise<void> {
    const tenants = await this.tenantService.findAll();
    for (const tenant of tenants) {
      try {
        const existing = await this.subscriptions.getByTenantId(tenant.id);
        if (!existing) await this.subscriptions.ensureFreeSubscription(tenant);
        else await this.subscriptions.syncStorageCapacity(tenant.id);
      } catch (error) {
        this.logger.error(
          `Failed to backfill subscription for tenant ${tenant.slug}: ${String(error)}`,
        );
      }
    }
  }
}
