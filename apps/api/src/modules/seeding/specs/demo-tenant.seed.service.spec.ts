import { DemoTenantSeedService } from '../demo-tenant/demo-tenant.seed.service';
import { createDemoTenantIdentity } from '../demo-tenant/demo-tenant.data';

const build = () => {
  const publicDataSource = {
    createQueryRunner: jest.fn(),
    getRepository: jest.fn(),
  };
  const seeding = { assertEnvironmentAllowed: jest.fn() };
  const plans = { findBySlug: jest.fn() };
  const subscriptions = {
    withTenantLock: jest.fn(),
    assignPlan: jest.fn(),
  };
  const r2 = { deleteMany: jest.fn() };
  const service = new DemoTenantSeedService(
    publicDataSource as never,
    { getOrThrow: jest.fn() } as never,
    seeding as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    plans as never,
    subscriptions as never,
    r2 as never,
    {} as never,
  );
  return {
    service,
    publicDataSource,
    seeding,
    plans,
    subscriptions,
    r2,
  };
};

describe('createDemoTenantIdentity', () => {
  it('creates a readable name and hyphenated slug without numeric suffixes', () => {
    const identity = createDemoTenantIdentity();

    expect(identity.name).toMatch(/^[A-Z][A-Za-z ]+ Market$/);
    expect(identity.slug).toMatch(/^[a-z]+(?:-[a-z]+)*-market$/);
    expect(identity.slug).not.toMatch(/^demo_\d+$/);
  });
});

describe('DemoTenantSeedService', () => {
  it('blocks production before opening a database lock', async () => {
    const { service, publicDataSource, seeding } = build();
    seeding.assertEnvironmentAllowed.mockImplementation(() => {
      throw new Error('Refusing to seed in production');
    });

    await expect(service.run()).rejects.toThrow(
      'Refusing to seed in production',
    );
    expect(seeding.assertEnvironmentAllowed).toHaveBeenCalledWith(false);
    expect(publicDataSource.createQueryRunner).not.toHaveBeenCalled();
  });

  it('requires both existing plans without creating replacements', async () => {
    const { service, plans } = build();
    plans.findBySlug.mockResolvedValue(null);

    await expect(
      (
        service as unknown as {
          requirePlans(): Promise<unknown>;
        }
      ).requirePlans(),
    ).rejects.toThrow('Free subscription plan is not seeded');
    expect(plans.findBySlug).toHaveBeenCalledTimes(2);
  });

  it('changes only a Free subscription to Starter under the tenant lock', async () => {
    const { service, subscriptions } = build();
    const manager = { findOne: jest.fn().mockResolvedValue({ planId: 1 }) };
    subscriptions.withTenantLock.mockImplementation(
      async (
        _tenantId: number,
        work: (value: typeof manager) => Promise<void>,
      ) => work(manager),
    );

    await (
      service as unknown as {
        assignStarter(
          tenant: { id: number; slug: string },
          free: { id: number },
          starter: { id: number },
        ): Promise<void>;
      }
    ).assignStarter({ id: 7, slug: 'demo' }, { id: 1 }, { id: 2 });

    expect(subscriptions.withTenantLock).toHaveBeenCalledWith(
      7,
      expect.any(Function),
    );
    expect(subscriptions.assignPlan).toHaveBeenCalledWith(
      7,
      expect.objectContaining({ planId: 2 }),
      manager,
    );
  });

  it('deletes uploaded objects only after the new tenant is removed', async () => {
    const { service, r2 } = build();
    const cleanupTarget = service as unknown as {
      cleanupDemoTenant(tenant: unknown): Promise<void>;
    };
    const cleanup = jest
      .spyOn(cleanupTarget, 'cleanupDemoTenant')
      .mockResolvedValue();
    const exposed = service as unknown as {
      compensateFailure(state: {
        tenant: { id: number };
        uploaded: Array<{ objectKey: string }>;
      }): Promise<unknown[]>;
    };

    await expect(
      exposed.compensateFailure({
        tenant: { id: 7 },
        uploaded: [{ objectKey: 'tenants/tenant_demo/products/image.webp' }],
      }),
    ).resolves.toEqual([]);

    expect(cleanup).toHaveBeenCalledTimes(1);
    expect(r2.deleteMany).toHaveBeenCalledWith([
      'tenants/tenant_demo/products/image.webp',
    ]);
    expect(cleanup.mock.invocationCallOrder[0]).toBeLessThan(
      r2.deleteMany.mock.invocationCallOrder[0],
    );
  });
});
