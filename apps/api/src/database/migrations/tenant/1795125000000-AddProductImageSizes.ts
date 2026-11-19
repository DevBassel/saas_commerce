import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddProductImageSizes1795125000000 implements MigrationInterface {
  name = 'AddProductImageSizes1795125000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await this.runUp(this.forConfiguredSchema(queryRunner));
  }

  private async runUp(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "__tenant_schema__"."product_images" RENAME COLUMN "sizeBytes" TO "storedSizeBytes"`,
    );
    await queryRunner.query(
      `ALTER TABLE "__tenant_schema__"."product_images" ADD "originalSizeBytes" bigint`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await this.runDown(this.forConfiguredSchema(queryRunner));
  }

  private async runDown(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "__tenant_schema__"."product_images" DROP COLUMN "originalSizeBytes"`,
    );
    await queryRunner.query(
      `ALTER TABLE "__tenant_schema__"."product_images" RENAME COLUMN "storedSizeBytes" TO "sizeBytes"`,
    );
  }

  private forConfiguredSchema(queryRunner: QueryRunner): QueryRunner {
    const schema = (queryRunner.connection.options as { schema?: string })
      .schema;
    if (!schema || !/^tenant_[a-z0-9_]{1,56}$/.test(schema)) {
      throw new Error(
        `Invalid tenant migration schema: ${schema ?? '<unset>'}`,
      );
    }

    const scopedRunner = Object.create(queryRunner) as QueryRunner;
    scopedRunner.query = (sql: string, parameters?: unknown[]) =>
      queryRunner.query(
        sql.replaceAll('"__tenant_schema__"', `"${schema}"`),
        parameters,
      );
    return scopedRunner;
  }
}
