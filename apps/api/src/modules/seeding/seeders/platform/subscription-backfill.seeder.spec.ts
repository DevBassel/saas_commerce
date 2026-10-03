import { SubscriptionBackfillSeeder } from './subscription-backfill.seeder';
import { TenantService } from 'src/modules/tenants/tenant.service';
import { SubscriptionService } from 'src/modules/subscriptions/services/subscription.service';

const build = () => {
  const tenantService = { findAll: jest.fn().mockResolvedValue([]) };
  const subscriptions = {
    getByTenantId: jest.fn().mockResolvedValue(null),
    ensureFreeSubscription: jest.fn().mockResolvedValue(undefined),
    syncStorageCapacity: jest.fn().mockResolvedValue(undefined),
  };
  const seeder = new SubscriptionBackfillSeeder(
    tenantService as unknown as TenantService,
    subscriptions as unknown as SubscriptionService,
  );
  return { seeder, tenantService, subscriptions };
};

describe('SubscriptionBackfillSeeder', () => {
  beforeEach(() => jest.clearAllMocks());

  it('assigns free to tenants without a subscription and re-syncs the rest', async () => {
    const { seeder, tenantService, subscriptions } = build();
    const a = { id: 1, slug: 'a' };
    const b = { id: 2, slug: 'b' };
    tenantService.findAll.mockResolvedValue([a, b]);
    subscriptions.getByTenantId.mockImplementation((id: number) =>
      Promise.resolve(id === 2 ? { id: 9 } : null),
    );

    await seeder.run();

    expect(seeder.name).toBe('subscription-backfill');
    expect(subscriptions.ensureFreeSubscription).toHaveBeenCalledWith(a);
    expect(subscriptions.syncStorageCapacity).toHaveBeenCalledWith(2);
  });

  it('continues when a tenant backfill fails', async () => {
    const { seeder, tenantService, subscriptions } = build();
    tenantService.findAll.mockResolvedValue([{ id: 1, slug: 'a' }]);
    subscriptions.getByTenantId.mockRejectedValue(new Error('boom'));

    await expect(seeder.run()).resolves.toBeUndefined();
  });
});
