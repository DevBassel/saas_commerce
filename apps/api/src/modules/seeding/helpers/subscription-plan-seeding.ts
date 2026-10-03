import { DataSource } from 'typeorm';
import { withUniqueRetry } from 'src/common/db/unique-retry';
import { SubscriptionPlan } from 'src/modules/subscriptions/entities/subscription-plan.entity';
import { SubscriptionPlanLimit } from 'src/modules/subscriptions/entities/subscription-plan-limit.entity';
import { SubscriptionPlanFeature } from 'src/modules/subscriptions/entities/subscription-plan-feature.entity';
import {
  PLAN_SEEDS,
  PlanFeatureSeed,
  PlanLimitSeed,
  PlanSeed,
} from '../constants/subscription-plan-seeds';

/** Both `DataSource` and the transactional `EntityManager` expose this. */
type RepositoryHost = { getRepository: DataSource['getRepository'] };

const upsertPlan = async (
  host: RepositoryHost,
  seed: PlanSeed,
): Promise<SubscriptionPlan> => {
  const repo = host.getRepository(SubscriptionPlan);
  await withUniqueRetry(() =>
    repo.upsert(
      [
        {
          slug: seed.slug,
          name: seed.name,
          description: seed.description,
          sortOrder: seed.sortOrder,
          active: true,
          isPublic: true,
        },
      ],
      ['slug'],
    ),
  );
  const plan = await repo.findOneBy({ slug: seed.slug });
  if (!plan) throw new Error(`Failed to seed subscription plan ${seed.slug}`);
  return plan;
};

const syncLimits = async (
  host: RepositoryHost,
  planId: number,
  limits: PlanLimitSeed[],
): Promise<void> => {
  const repo = host.getRepository(SubscriptionPlanLimit);
  const existing = await repo.find({ where: { planId } });
  const wanted = new Set(limits.map((limit) => limit.key));

  if (limits.length > 0) {
    await repo.upsert(
      limits.map((limit) => ({
        planId,
        key: limit.key,
        value: limit.value,
        type: limit.type,
      })),
      ['planId', 'key'],
    );
  }

  const stale = existing.filter((row) => !wanted.has(row.key));
  if (stale.length > 0) await repo.delete(stale.map((row) => row.id));
};

const syncFeatures = async (
  host: RepositoryHost,
  planId: number,
  features: PlanFeatureSeed[],
): Promise<void> => {
  const repo = host.getRepository(SubscriptionPlanFeature);
  const existing = await repo.find({ where: { planId } });
  const wanted = new Set(features.map((feature) => feature.key));

  if (features.length > 0) {
    await repo.upsert(
      features.map((feature) => ({
        planId,
        key: feature.key,
        enabled: feature.enabled,
      })),
      ['planId', 'key'],
    );
  }

  const stale = existing.filter((row) => !wanted.has(row.key));
  if (stale.length > 0) await repo.delete(stale.map((row) => row.id));
};

/**
 * Upserts the seeded subscription plans by `slug` and syncs each plan's limits
 * and features to the exact seeded set. Idempotent and conflict-safe.
 */
export const seedSubscriptionPlans = async (
  ds: DataSource,
): Promise<number> => {
  for (const seed of PLAN_SEEDS) {
    await ds.transaction(async (manager) => {
      const plan = await upsertPlan(manager, seed);
      await syncLimits(manager, plan.id, seed.limits);
      await syncFeatures(manager, plan.id, seed.features);
    });
  }
  return PLAN_SEEDS.length;
};
