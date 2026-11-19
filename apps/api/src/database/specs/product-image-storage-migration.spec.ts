import { QueryRunner } from 'typeorm';
import { AddProductImageSizes1795125000000 } from '../migrations/tenant/1795125000000-AddProductImageSizes';
import { ReconcileProductImageStorage1795125000001 } from '../migrations/platform/1795125000001-ReconcileProductImageStorage';

describe('product image storage migrations', () => {
  it('separates stored and original sizes while leaving unknown legacy originals null', async () => {
    const query = jest.fn().mockResolvedValue(undefined);
    const runner = {
      connection: { options: { schema: 'tenant_test' } },
      query,
    } as unknown as QueryRunner;

    await new AddProductImageSizes1795125000000().up(runner);

    expect(query.mock.calls.map(([statement]) => String(statement))).toEqual([
      'ALTER TABLE "tenant_test"."product_images" RENAME COLUMN "sizeBytes" TO "storedSizeBytes"',
      'ALTER TABLE "tenant_test"."product_images" ADD "originalSizeBytes" bigint',
    ]);
  });

  it('reconciles tenant counters from either side of the column rename', async () => {
    const query = jest.fn((sql: string, parameters?: unknown[]) => {
      if (sql.startsWith('SELECT "id"')) {
        return Promise.resolve([
          { id: 1, schemaName: 'tenant_legacy' },
          { id: 2, schemaName: 'tenant_current' },
        ]);
      }
      if (sql.includes('information_schema.columns')) {
        return Promise.resolve([
          {
            columnName:
              parameters?.[0] === 'tenant_current'
                ? 'storedSizeBytes'
                : 'sizeBytes',
          },
        ]);
      }
      if (sql.includes('tenant_legacy')) {
        return Promise.resolve([{ usedBytes: '12' }]);
      }
      if (sql.includes('tenant_current')) {
        return Promise.resolve([{ usedBytes: '7' }]);
      }
      return Promise.resolve(undefined);
    });
    const runner = {
      connection: { options: { schema: 'public' } },
      query,
    } as unknown as QueryRunner;

    await new ReconcileProductImageStorage1795125000001().up(runner);

    expect(query).toHaveBeenCalledWith(
      'UPDATE "public"."tenants" SET "storageUsedBytes" = $1 WHERE "id" = $2',
      ['12', 1],
    );
    expect(query).toHaveBeenCalledWith(
      'UPDATE "public"."tenants" SET "storageUsedBytes" = $1 WHERE "id" = $2',
      ['7', 2],
    );
  });
});
