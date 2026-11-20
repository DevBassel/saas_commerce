import { MigrationInterface, QueryRunner } from 'typeorm';
import { AddUserTokenVersion1795130000000 } from '../migrations/platform/1795130000000-AddUserTokenVersion';
import { AddUserTokenVersion1795130000001 } from '../migrations/tenant/1795130000001-AddUserTokenVersion';

describe('user token version migrations', () => {
  it('adds the platform token version with a safe default', async () => {
    const query = jest.fn().mockResolvedValue(undefined);
    const runner = {
      connection: { options: { schema: 'public' } },
      query,
    } as unknown as QueryRunner;

    await new AddUserTokenVersion1795130000000().up(runner);

    expect(query).toHaveBeenCalledWith(
      'ALTER TABLE "public"."user" ADD "tokenVersion" integer NOT NULL DEFAULT 0',
      undefined,
    );
  });

  it('adds the token version to each configured tenant schema', async () => {
    const query = jest.fn().mockResolvedValue(undefined);
    const runner = {
      connection: { options: { schema: 'tenant_test' } },
      query,
    } as unknown as QueryRunner;

    await new AddUserTokenVersion1795130000001().up(runner);

    expect(query).toHaveBeenCalledWith(
      'ALTER TABLE "tenant_test"."user" ADD "tokenVersion" integer NOT NULL DEFAULT 0',
      undefined,
    );
  });

  it.each<[string, MigrationInterface, string, string]>([
    [
      'platform',
      new AddUserTokenVersion1795130000000(),
      'public',
      'SELECT COUNT(*) AS "count" FROM "public"."user" WHERE "tokenVersion" <> 0',
    ],
    [
      'tenant',
      new AddUserTokenVersion1795130000001(),
      'tenant_test',
      'SELECT COUNT(*) AS "count" FROM "tenant_test"."user" WHERE "tokenVersion" <> 0',
    ],
  ])(
    'refuses to erase %s revocation state during rollback',
    async (_scope, migration, schema, countSql) => {
      const query = jest.fn().mockResolvedValue([{ count: '1' }]);
      const runner = {
        connection: { options: { schema } },
        query,
      } as unknown as QueryRunner;

      await expect(migration.down(runner)).rejects.toThrow(
        'Unsafe rollback refused: user token revocation state exists',
      );
      expect(query).toHaveBeenCalledWith(countSql, undefined);
      expect(query).toHaveBeenCalledTimes(1);
    },
  );
});
