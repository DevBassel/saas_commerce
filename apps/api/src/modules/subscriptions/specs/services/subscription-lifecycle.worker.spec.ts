import { SUBSCRIPTION_LIFECYCLE_INTERVAL_MS } from '../../constants/subscription.constants';
import { SubscriptionLifecycleWorker } from '../../services/subscription-lifecycle.worker';

describe('SubscriptionLifecycleWorker', () => {
  const originalSeedCli = process.env.SEED_CLI;

  afterEach(() => {
    jest.useRealTimers();
    if (originalSeedCli === undefined) delete process.env.SEED_CLI;
    else process.env.SEED_CLI = originalSeedCli;
  });

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

  it('does not start while a seed CLI owns the application context', () => {
    process.env.SEED_CLI = 'true';
    const lifecycle = { reconcileExpired: jest.fn() };
    const worker = new SubscriptionLifecycleWorker(lifecycle as never);

    worker.onApplicationBootstrap();

    expect(lifecycle.reconcileExpired).not.toHaveBeenCalled();
    worker.onModuleDestroy();
  });
});
