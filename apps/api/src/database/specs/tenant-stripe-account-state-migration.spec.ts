import { QueryRunner } from 'typeorm';
import { AddTenantStripeAccountState1795121230425 } from '../migrations/platform/1795121230425-AddTenantStripeAccountState';

const buildRunner = () => {
  const query = jest.fn().mockResolvedValue(undefined);
  const runner = {
    connection: { options: { schema: 'platform_test' } },
    query,
  } as unknown as QueryRunner;

  return { runner, query };
};

describe('AddTenantStripeAccountState1795121230425', () => {
  it('adds non-null Connect state columns with safe defaults', async () => {
    const { runner, query } = buildRunner();

    await new AddTenantStripeAccountState1795121230425().up(runner);

    expect(query.mock.calls.map(([statement]) => String(statement))).toEqual([
      'ALTER TABLE "platform_test"."tenants" ADD "stripeChargesEnabled" boolean NOT NULL DEFAULT false',
      'ALTER TABLE "platform_test"."tenants" ADD "stripePayoutsEnabled" boolean NOT NULL DEFAULT false',
      'ALTER TABLE "platform_test"."tenants" ADD "stripeDetailsSubmitted" boolean NOT NULL DEFAULT false',
    ]);
  });

  it('drops only the added Connect state columns on rollback', async () => {
    const { runner, query } = buildRunner();

    await new AddTenantStripeAccountState1795121230425().down(runner);

    expect(query.mock.calls.map(([statement]) => String(statement))).toEqual([
      'ALTER TABLE "platform_test"."tenants" DROP COLUMN "stripeDetailsSubmitted"',
      'ALTER TABLE "platform_test"."tenants" DROP COLUMN "stripePayoutsEnabled"',
      'ALTER TABLE "platform_test"."tenants" DROP COLUMN "stripeChargesEnabled"',
    ]);
  });
});
