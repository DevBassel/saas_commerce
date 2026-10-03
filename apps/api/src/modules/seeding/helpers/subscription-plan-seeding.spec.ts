import { DataSource } from 'typeorm';
import { seedSubscriptionPlans } from './subscription-plan-seeding';
import { SubscriptionPlan } from 'src/modules/subscriptions/entities/subscription-plan.entity';
import { SubscriptionPlanLimit } from 'src/modules/subscriptions/entities/subscription-plan-limit.entity';

type Row = Record<string, unknown> & { id?: number };

const asArray = (value: unknown): Row[] =>
  Array.isArray(value) ? (value as Row[]) : [value as Row];

const buildFakeDs = () => {
  const plans = new Map<string, Row>();
  const limits: Row[] = [];
  const features: Row[] = [];
  let planSeq = 0;
  let childSeq = 0;

  const planRepo = {
    upsert: jest.fn((rows: unknown) => {
      for (const row of asArray(rows)) {
        const existing = plans.get(row.slug as string);
        if (existing) Object.assign(existing, row);
        else plans.set(row.slug as string, { ...row, id: ++planSeq });
      }
      return Promise.resolve(undefined);
    }),
    findOneBy: jest.fn(({ slug }: { slug: string }) =>
      Promise.resolve(plans.get(slug) ?? null),
    ),
  };

  const childRepo = (store: Row[], key: string) => ({
    find: jest.fn(({ where }: { where: { planId: number } }) =>
      Promise.resolve(store.filter((row) => row.planId === where.planId)),
    ),
    upsert: jest.fn((rows: unknown) => {
      for (const row of asArray(rows)) {
        const existing = store.find(
          (item) => item.planId === row.planId && item[key] === row[key],
        );
        if (existing) Object.assign(existing, row);
        else store.push({ ...row, id: ++childSeq });
      }
      return Promise.resolve(undefined);
    }),
    delete: jest.fn((ids: number[]) => {
      const remove = new Set(Array.isArray(ids) ? ids : [ids]);
      for (let i = store.length - 1; i >= 0; i -= 1) {
        if (remove.has(store[i].id as number)) store.splice(i, 1);
      }
      return Promise.resolve(undefined);
    }),
  });

  const limitRepo = childRepo(limits, 'key');
  const featureRepo = childRepo(features, 'key');

  const ds = {
    getRepository: jest.fn((entity: unknown) => {
      if (entity === SubscriptionPlan) return planRepo;
      if (entity === SubscriptionPlanLimit) return limitRepo;
      return featureRepo;
    }),
    transaction: jest.fn((cb: (m: unknown) => unknown) => cb(ds)),
  } as unknown as DataSource;

  return { ds, plans, limits, features };
};

describe('seedSubscriptionPlans', () => {
  it('seeds all five plans with limits and features', async () => {
    const { ds, plans, limits, features } = buildFakeDs();

    const count = await seedSubscriptionPlans(ds);

    expect(count).toBe(5);
    expect([...plans.keys()].sort()).toEqual([
      'enterprise',
      'free',
      'growth',
      'pro',
      'starter',
    ]);
    expect(limits.length).toBeGreaterThan(0);
    expect(features.length).toBeGreaterThan(0);
  });

  it('is idempotent: a second run creates no duplicates', async () => {
    const { ds, plans, limits, features } = buildFakeDs();
    await seedSubscriptionPlans(ds);
    const limitCount = limits.length;
    const featureCount = features.length;

    await seedSubscriptionPlans(ds);

    expect(plans.size).toBe(5);
    expect(limits.length).toBe(limitCount);
    expect(features.length).toBe(featureCount);
  });

  it('gives enterprise no limit rows (unlimited)', async () => {
    const { ds, plans, limits } = buildFakeDs();
    await seedSubscriptionPlans(ds);

    const enterprise = plans.get('enterprise');
    const enterpriseLimits = limits.filter(
      (limit) => limit.planId === enterprise?.id,
    );
    expect(enterpriseLimits).toHaveLength(0);
  });
});
