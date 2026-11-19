import { DataSource, EntityManager } from 'typeorm';
import { Subscription } from '../../../payments/entities/subscription.entity';
import { SubscriptionStatus } from '../../constants/subscription-status.enum';
import { SubscriptionLifecycleService } from '../../services/subscription-lifecycle.service';

interface UpdateCall {
  criteria: { status: SubscriptionStatus; planId?: unknown };
  patch: { status: SubscriptionStatus };
}

describe('SubscriptionLifecycleService', () => {
  it('reconciles expired lifecycle states in transition order', async () => {
    const update = jest
      .fn()
      .mockResolvedValueOnce({ affected: 1 })
      .mockResolvedValueOnce({ affected: 2 })
      .mockResolvedValueOnce({ affected: 3 })
      .mockResolvedValueOnce({ affected: 4 });
    const subscriptions = { update };
    const plans = {
      findOneBy: jest.fn().mockResolvedValue({ id: 9, slug: 'free' }),
    };
    const manager = {
      getRepository: jest.fn((entity: unknown) =>
        entity === Subscription ? subscriptions : plans,
      ),
    } as unknown as EntityManager;
    const dataSource = {
      transaction: jest.fn((callback: (value: EntityManager) => unknown) =>
        callback(manager),
      ),
    } as unknown as DataSource;
    const service = new SubscriptionLifecycleService(dataSource);
    const now = new Date('2026-06-15T00:00:00.000Z');

    await expect(service.reconcileExpired(now)).resolves.toEqual({
      trialsActivated: 2,
      trialsExpired: 3,
      subscriptionsPastDue: 4,
      subscriptionsUnpaid: 1,
    });

    expect(plans.findOneBy).toHaveBeenCalledWith({ slug: 'free' });
    const calls = update.mock.calls as unknown as Array<
      [UpdateCall['criteria'], UpdateCall['patch']]
    >;
    expect(
      calls.map(([criteria, patch]) => [criteria.status, patch.status]),
    ).toEqual([
      [SubscriptionStatus.PAST_DUE, SubscriptionStatus.UNPAID],
      [SubscriptionStatus.TRIALING, SubscriptionStatus.ACTIVE],
      [SubscriptionStatus.TRIALING, SubscriptionStatus.INCOMPLETE_EXPIRED],
      [SubscriptionStatus.ACTIVE, SubscriptionStatus.PAST_DUE],
    ]);
    expect(calls[0][0]).toHaveProperty('planId');
    expect(calls[3][0]).toHaveProperty('planId');
  });
});
