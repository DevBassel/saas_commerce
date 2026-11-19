import { MigrationInterface, QueryRunner } from 'typeorm';

type TenantStorageRow = {
  id: number;
  schemaName: string;
};

type ColumnRow = {
  columnName: 'storedSizeBytes' | 'sizeBytes';
};

export class ReconcileProductImageStorage1795125000001 implements MigrationInterface {
  name = 'ReconcileProductImageStorage1795125000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const scopedRunner = this.forConfiguredSchema(queryRunner);
    const tenants = (await scopedRunner.query(
      `SELECT "id", "schemaName" FROM "__platform_schema__"."tenants"`,
    )) as TenantStorageRow[];

    for (const tenant of tenants) {
      if (!/^tenant_[a-z0-9_]{1,56}$/.test(tenant.schemaName)) continue;

      const columns = (await scopedRunner.query(
        `SELECT "column_name" AS "columnName" FROM information_schema.columns WHERE table_schema = $1 AND table_name = 'product_images' AND column_name IN ('storedSizeBytes', 'sizeBytes')`,
        [tenant.schemaName],
      )) as ColumnRow[];
      const storedColumn = columns.some(
        (column) => column.columnName === 'storedSizeBytes',
      )
        ? 'storedSizeBytes'
        : columns.some((column) => column.columnName === 'sizeBytes')
          ? 'sizeBytes'
          : null;

      let usedBytes = '0';
      if (storedColumn) {
        const rows = (await scopedRunner.query(
          `SELECT COALESCE(SUM("${storedColumn}"), 0)::text AS "usedBytes" FROM "${tenant.schemaName}"."product_images"`,
        )) as Array<{ usedBytes: string }>;
        usedBytes = rows[0]?.usedBytes ?? '0';
      }

      await scopedRunner.query(
        `UPDATE "__platform_schema__"."tenants" SET "storageUsedBytes" = $1 WHERE "id" = $2`,
        [usedBytes, tenant.id],
      );
    }
  }

  public async down(): Promise<void> {
    // The previous drift cannot be reconstructed; keep the reconciled counters.
  }

  private forConfiguredSchema(queryRunner: QueryRunner): QueryRunner {
    const schema = (queryRunner.connection.options as { schema?: string })
      .schema;
    if (!schema || !/^[a-z][a-z0-9_]{0,62}$/.test(schema)) {
      throw new Error(
        `Invalid platform migration schema: ${schema ?? '<unset>'}`,
      );
    }

    const scopedRunner = Object.create(queryRunner) as QueryRunner;
    scopedRunner.query = (sql: string, parameters?: unknown[]) =>
      queryRunner.query(
        sql.replaceAll('"__platform_schema__"', `"${schema}"`),
        parameters,
      );
    return scopedRunner;
  }
}
