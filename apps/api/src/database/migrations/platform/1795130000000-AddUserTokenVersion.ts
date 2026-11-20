import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserTokenVersion1795130000000 implements MigrationInterface {
  name = 'AddUserTokenVersion1795130000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await this.runUp(this.forConfiguredSchema(queryRunner));
  }

  private async runUp(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "__platform_schema__"."user" ADD "tokenVersion" integer NOT NULL DEFAULT 0`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await this.runDown(this.forConfiguredSchema(queryRunner));
  }

  private async runDown(queryRunner: QueryRunner): Promise<void> {
    const [{ count }] = (await queryRunner.query(
      `SELECT COUNT(*) AS "count" FROM "__platform_schema__"."user" WHERE "tokenVersion" <> 0`,
    )) as Array<{ count: string }>;
    if (Number(count) > 0) {
      throw new Error(
        'Unsafe rollback refused: user token revocation state exists',
      );
    }

    await queryRunner.query(
      `ALTER TABLE "__platform_schema__"."user" DROP COLUMN "tokenVersion"`,
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
