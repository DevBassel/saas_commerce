import { QueryRunner } from 'typeorm';
import { AddTenantProvisioningState1795105096744 } from '../migrations/platform/1795105096744-AddTenantProvisioningState';

const buildRunner = (recoveryRows = 0) => {
  const query = jest.fn((sql: string) => {
    if (sql.startsWith('SELECT COUNT(*)')) {
      return Promise.resolve([{ count: String(recoveryRows) }]);
    }
    return Promise.resolve(undefined);
  });
  const runner = {
    connection: { options: { schema: 'public' } },
    query,
  } as unknown as QueryRunner;
  return { runner, query };
};

describe('AddTenantProvisioningState1795105096744', () => {
  it('adds durable state, retry and failure columns and backfills safely', async () => {
    const { runner, query } = buildRunner();

    await new AddTenantProvisioningState1795105096744().up(runner);

    const sql = query.mock.calls
      .map(([statement]) => String(statement))
      .join('\n');
    expect(sql).toContain('"public"."tenant_provisioning_state_enum"');
    expect(sql).toContain('ADD "provisioningState"');
    expect(sql).toContain('ADD "provisioningAttempts"');
    expect(sql).toContain('ADD "provisioningFailedStep"');
    expect(sql).toContain('ADD "provisioningOwnerPasswordHash"');
    expect(sql).toContain('tenant."ownerUserId" IS NOT NULL AND EXISTS');
    expect(sql).toContain(
      `SET "status" = 'inactive' WHERE "provisioningState" <> 'ACTIVE'`,
    );
    expect(sql).toContain(
      'Legacy incomplete tenant requires explicit cleanup before retry',
    );
    expect(sql).toContain('ALTER COLUMN "provisioningState" SET NOT NULL');
  });

  it('refuses rollback while recoverable provisioning state exists', async () => {
    const { runner, query } = buildRunner(1);

    await expect(
      new AddTenantProvisioningState1795105096744().down(runner),
    ).rejects.toThrow('Unsafe rollback refused');

    expect(
      query.mock.calls.some(([statement]) =>
        String(statement).includes('DROP COLUMN "provisioningState"'),
      ),
    ).toBe(false);
  });
});
