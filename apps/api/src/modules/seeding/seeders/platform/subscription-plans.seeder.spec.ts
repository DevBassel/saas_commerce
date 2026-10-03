import { DataSource } from 'typeorm';
import { SubscriptionPlansSeeder } from './subscription-plans.seeder';
import { seedSubscriptionPlans } from '../../helpers/subscription-plan-seeding';

jest.mock('../../helpers/subscription-plan-seeding', () => ({
  seedSubscriptionPlans: jest.fn().mockResolvedValue(5),
}));

const seedSubscriptionPlansMock = seedSubscriptionPlans as jest.MockedFunction<
  typeof seedSubscriptionPlans
>;

describe('SubscriptionPlansSeeder', () => {
  beforeEach(() => jest.clearAllMocks());

  it('delegates plan seeding to the shared helper', async () => {
    const dataSource = { name: 'public' } as unknown as DataSource;
    const seeder = new SubscriptionPlansSeeder();

    await seeder.run({ dataSource, environment: 'development' });

    expect(seeder.name).toBe('subscription-plans');
    expect(seedSubscriptionPlansMock).toHaveBeenCalledWith(dataSource);
  });
});
