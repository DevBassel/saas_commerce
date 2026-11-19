import { SUBSCRIPTION_LIFECYCLE_INTERVAL_MS } from '../../constants/subscription.constants';
import { SubscriptionLifecycleWorker } from '../../services/subscription-lifecycle.worker';

describe('SubscriptionLifecycleWorker', () => {
  afterEach(() => jest.useRealTimers());

  it('runs at bootstrap and periodically without overlapping', async () => {
    jest.useFakeTimers();
    let finishFirst: (() => void) | undefined;
    const lifecycle = {
      reconcileExpired: jest.fn().mockImplementation(
        () =>
          new Promise((resolve) => {
            finishFirst = () =>
              resolve({
                trialsActivated: 0,
                trialsExpired: 0,
                subscriptionsPastDue: 0,
                subscriptionsUnpaid: 0,
              });
          }),
      ),
    };
    const worker = new SubscriptionLifecycleWorker(lifecycle as never);

    worker.onApplicationBootstrap();
    jest.advanceTimersByTime(SUBSCRIPTION_LIFECYCLE_INTERVAL_MS);
    expect(lifecycle.reconcileExpired).toHaveBeenCalledTimes(1);

    finishFirst?.();
    await Promise.resolve();
    jest.advanceTimersByTime(SUBSCRIPTION_LIFECYCLE_INTERVAL_MS);
    expect(lifecycle.reconcileExpired).toHaveBeenCalledTimes(2);

    worker.onModuleDestroy();
  });
});
