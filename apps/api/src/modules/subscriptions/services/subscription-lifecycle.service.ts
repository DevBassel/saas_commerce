import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import {
  DataSource,
  IsNull,
  LessThanOrEqual,
  MoreThan,
  Not,
  Or,
} from 'typeorm';
import { Subscription } from '../../payments/entities/subscription.entity';
import { SubscriptionPlan } from '../entities/subscription-plan.entity';
import { SubscriptionStatus } from '../constants/subscription-status.enum';
import { FREE_PLAN_SLUG } from '../constants/subscription.constants';

export interface SubscriptionLifecycleResult {
  trialsActivated: number;
  trialsExpired: number;
  subscriptionsPastDue: number;
  subscriptionsUnpaid: number;
}

/**
 * Reconciles persisted statuses after their access timestamps elapse. Updates
 * are predicate-guarded, so concurrent workers remain idempotent.
 */
@Injectable()
export class SubscriptionLifecycleService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  reconcileExpired(
    now: Date = new Date(),
  ): Promise<SubscriptionLifecycleResult> {
    return this.dataSource.transaction(async (manager) => {
      const subscriptions = manager.getRepository(Subscription);
      const plans = manager.getRepository(SubscriptionPlan);
      const freePlan = await plans.findOneBy({ slug: FREE_PLAN_SLUG });
      const elapsed = Or(IsNull(), LessThanOrEqual(now));
      const paidPlan = freePlan ? { planId: Not(freePlan.id) } : {};

      // Existing overdue rows become terminal first. Newly expired ACTIVE rows
      // then remain PAST_DUE until the next reconciliation cycle.
      const unpaid = await subscriptions.update(
        {
          status: SubscriptionStatus.PAST_DUE,
          currentPeriodEnd: elapsed,
          ...paidPlan,
        },
        { status: SubscriptionStatus.UNPAID },
      );

      const activatedTrials = await subscriptions.update(
        {
          status: SubscriptionStatus.TRIALING,
          trialEnd: elapsed,
          currentPeriodEnd: MoreThan(now),
        },
        { status: SubscriptionStatus.ACTIVE },
      );

      const expiredTrials = await subscriptions.update(
        {
          status: SubscriptionStatus.TRIALING,
          trialEnd: elapsed,
          currentPeriodEnd: elapsed,
        },
        { status: SubscriptionStatus.INCOMPLETE_EXPIRED },
      );

      const pastDue = await subscriptions.update(
        {
          status: SubscriptionStatus.ACTIVE,
          currentPeriodEnd: elapsed,
          ...paidPlan,
        },
        { status: SubscriptionStatus.PAST_DUE },
      );

      return {
        trialsActivated: activatedTrials.affected ?? 0,
        trialsExpired: expiredTrials.affected ?? 0,
        subscriptionsPastDue: pastDue.affected ?? 0,
        subscriptionsUnpaid: unpaid.affected ?? 0,
      };
    });
  }
}
