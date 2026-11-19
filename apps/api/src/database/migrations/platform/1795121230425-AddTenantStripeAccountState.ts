import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTenantStripeAccountState1795121230425 implements MigrationInterface {
  name = 'AddTenantStripeAccountState1795121230425';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await this.runUp(this.forConfiguredSchema(queryRunner));
  }

  private async runUp(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "__platform_schema__"."tenants" ADD "stripeChargesEnabled" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "__platform_schema__"."tenants" ADD "stripePayoutsEnabled" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "__platform_schema__"."tenants" ADD "stripeDetailsSubmitted" boolean NOT NULL DEFAULT false`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await this.runDown(this.forConfiguredSchema(queryRunner));
  }

  private async runDown(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "__platform_schema__"."tenants" DROP COLUMN "stripeDetailsSubmitted"`,
    );
    await queryRunner.query(
      `ALTER TABLE "__platform_schema__"."tenants" DROP COLUMN "stripePayoutsEnabled"`,
    );
    await queryRunner.query(
      `ALTER TABLE "__platform_schema__"."tenants" DROP COLUMN "stripeChargesEnabled"`,
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
