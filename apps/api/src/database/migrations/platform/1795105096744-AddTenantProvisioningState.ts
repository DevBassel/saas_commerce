import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTenantProvisioningState1795105096744 implements MigrationInterface {
  name = 'AddTenantProvisioningState1795105096744';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await this.runUp(this.forConfiguredSchema(queryRunner));
  }

  private async runUp(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "__platform_schema__"."tenant_provisioning_state_enum" AS ENUM('PENDING', 'TENANT_CREATED', 'SCHEMA_CREATED', 'MIGRATED', 'SEEDED', 'SUBSCRIPTION_ASSIGNED', 'OWNER_CREATED', 'ACTIVE')`,
    );
    await queryRunner.query(
      `ALTER TABLE "__platform_schema__"."tenants" ADD "provisioningState" "__platform_schema__"."tenant_provisioning_state_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "__platform_schema__"."tenants" ADD "provisioningOwnerEmail" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "__platform_schema__"."tenants" ADD "provisioningOwnerName" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "__platform_schema__"."tenants" ADD "provisioningOwnerPasswordHash" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "__platform_schema__"."tenants" ADD "provisioningAttempts" integer NOT NULL DEFAULT '0'`,
    );
    await queryRunner.query(
      `ALTER TABLE "__platform_schema__"."tenants" ADD "provisioningFailedStep" "__platform_schema__"."tenant_provisioning_state_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "__platform_schema__"."tenants" ADD "provisioningLastError" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "__platform_schema__"."tenants" ADD "provisioningFailedAt" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `UPDATE "__platform_schema__"."tenants" tenant SET "provisioningState" = CASE WHEN tenant."ownerUserId" IS NOT NULL AND EXISTS (SELECT 1 FROM "__platform_schema__"."subscriptions" subscription WHERE subscription."tenantId" = tenant."id") THEN 'ACTIVE'::"__platform_schema__"."tenant_provisioning_state_enum" ELSE 'PENDING'::"__platform_schema__"."tenant_provisioning_state_enum" END`,
    );
    await queryRunner.query(
      `UPDATE "__platform_schema__"."tenants" SET "status" = 'inactive' WHERE "provisioningState" <> 'ACTIVE'`,
    );
    await queryRunner.query(
      `UPDATE "__platform_schema__"."tenants" SET "provisioningFailedStep" = 'TENANT_CREATED', "provisioningLastError" = 'Legacy incomplete tenant requires explicit cleanup before retry', "provisioningFailedAt" = now() WHERE "provisioningState" = 'PENDING'`,
    );
    await queryRunner.query(
      `ALTER TABLE "__platform_schema__"."tenants" ALTER COLUMN "provisioningState" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "__platform_schema__"."tenants" ALTER COLUMN "provisioningState" SET DEFAULT 'PENDING'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await this.runDown(this.forConfiguredSchema(queryRunner));
  }

  private async runDown(queryRunner: QueryRunner): Promise<void> {
    const [{ count }] = (await queryRunner.query(
      `SELECT COUNT(*) AS "count" FROM "__platform_schema__"."tenants" WHERE "provisioningState" <> 'ACTIVE' OR "provisioningLastError" IS NOT NULL`,
    )) as Array<{ count: string }>;
    if (Number(count) > 0) {
      throw new Error(
        'Unsafe rollback refused: tenant provisioning recovery state exists',
      );
    }

    await queryRunner.query(
      `ALTER TABLE "__platform_schema__"."tenants" DROP COLUMN "provisioningFailedAt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "__platform_schema__"."tenants" DROP COLUMN "provisioningLastError"`,
    );
    await queryRunner.query(
      `ALTER TABLE "__platform_schema__"."tenants" DROP COLUMN "provisioningFailedStep"`,
    );
    await queryRunner.query(
      `ALTER TABLE "__platform_schema__"."tenants" DROP COLUMN "provisioningAttempts"`,
    );
    await queryRunner.query(
      `ALTER TABLE "__platform_schema__"."tenants" DROP COLUMN "provisioningOwnerEmail"`,
    );
    await queryRunner.query(
      `ALTER TABLE "__platform_schema__"."tenants" DROP COLUMN "provisioningOwnerName"`,
    );
    await queryRunner.query(
      `ALTER TABLE "__platform_schema__"."tenants" DROP COLUMN "provisioningOwnerPasswordHash"`,
    );
    await queryRunner.query(
      `ALTER TABLE "__platform_schema__"."tenants" DROP COLUMN "provisioningState"`,
    );
    await queryRunner.query(
      `DROP TYPE "__platform_schema__"."tenant_provisioning_state_enum"`,
    );
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
