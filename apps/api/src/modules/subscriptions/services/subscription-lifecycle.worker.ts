import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { SUBSCRIPTION_LIFECYCLE_INTERVAL_MS } from '../constants/subscription.constants';
import { SubscriptionLifecycleService } from './subscription-lifecycle.service';

@Injectable()
export class SubscriptionLifecycleWorker
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(SubscriptionLifecycleWorker.name);
  private timer?: ReturnType<typeof setInterval>;
  private running = false;

  constructor(private readonly lifecycle: SubscriptionLifecycleService) {}

  onApplicationBootstrap(): void {
    if (process.env.SEED_CLI === 'true') return;
    void this.reconcileNow();
    this.timer = setInterval(
      () => void this.reconcileNow(),
      SUBSCRIPTION_LIFECYCLE_INTERVAL_MS,
    );
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async reconcileNow(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const result = await this.lifecycle.reconcileExpired();
      const changed =
        result.trialsActivated +
        result.trialsExpired +
        result.subscriptionsPastDue +
        result.subscriptionsUnpaid;
      if (changed > 0)
        this.logger.log(`Reconciled ${changed} subscription lifecycle rows`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const stack = error instanceof Error ? error.stack : undefined;
      this.logger.error(
        `Subscription lifecycle reconciliation failed: ${message}`,
        stack,
      );
    } finally {
      this.running = false;
    }
  }
}
