import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserTokenVersion1795130000001 implements MigrationInterface {
  name = 'AddUserTokenVersion1795130000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await this.runUp(this.forConfiguredSchema(queryRunner));
  }

  private async runUp(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "__tenant_schema__"."user" ADD "tokenVersion" integer NOT NULL DEFAULT 0`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await this.runDown(this.forConfiguredSchema(queryRunner));
  }

  private async runDown(queryRunner: QueryRunner): Promise<void> {
    const [{ count }] = (await queryRunner.query(
      `SELECT COUNT(*) AS "count" FROM "__tenant_schema__"."user" WHERE "tokenVersion" <> 0`,
    )) as Array<{ count: string }>;
    if (Number(count) > 0) {
      throw new Error(
        'Unsafe rollback refused: user token revocation state exists',
      );
    }

    await queryRunner.query(
      `ALTER TABLE "__tenant_schema__"."user" DROP COLUMN "tokenVersion"`,
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
