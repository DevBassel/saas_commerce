import { Injectable, Logger } from '@nestjs/common';
import { seedSubscriptionPlans } from '../../helpers/subscription-plan-seeding';
import { SeederOrder } from '../../constants/seeding.constants';
import {
  PlatformSeeder,
  SeederContext,
} from '../../interfaces/seeder.interface';

@Injectable()
export class SubscriptionPlansSeeder implements PlatformSeeder {
  readonly name = 'subscription-plans';
  readonly order = SeederOrder.SUBSCRIPTION_PLANS;

  private readonly logger = new Logger(SubscriptionPlansSeeder.name);

  async run(context: SeederContext): Promise<void> {
    const count = await seedSubscriptionPlans(context.dataSource);
    this.logger.log(`Seeded ${count} subscription plans`);
  }
}
