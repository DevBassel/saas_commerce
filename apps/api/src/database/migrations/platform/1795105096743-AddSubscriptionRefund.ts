import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSubscriptionRefund1795105096743 implements MigrationInterface {
  name = 'AddSubscriptionRefund1795105096743';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await this.runUp(this.forConfiguredSchema(queryRunner));
  }

  private async runUp(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "__platform_schema__"."subscription_payments_status_enum" ADD VALUE 'REFUND_PENDING'`,
    );
    await queryRunner.query(
      `CREATE TYPE "__platform_schema__"."subscription_refunds_status_enum" AS ENUM('PENDING', 'PROCESSING', 'SUCCEEDED', 'FAILED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "__platform_schema__"."subscription_refunds" ("id" SERIAL NOT NULL, "paymentId" integer NOT NULL, "subscriptionId" integer NOT NULL, "amount" numeric(10,2) NOT NULL, "currency" character varying NOT NULL, "idempotencyKey" character varying NOT NULL, "providerRefundId" character varying, "providerStatus" character varying, "status" "__platform_schema__"."subscription_refunds_status_enum" NOT NULL DEFAULT 'PENDING', "attempts" integer NOT NULL DEFAULT '0', "nextRetryAt" TIMESTAMP, "lastError" text, "completedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_50674c2cd9e15b27fc1c85bd5ce" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_3027551699118ee1b0de8b25d2" ON "__platform_schema__"."subscription_refunds" ("paymentId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_2442cf12b750944970dfd57831" ON "__platform_schema__"."subscription_refunds" ("subscriptionId") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_54f731c88aad9c3de2bd95537a" ON "__platform_schema__"."subscription_refunds" ("idempotencyKey") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_bc30ef57f41b59d3f6e955afc9" ON "__platform_schema__"."subscription_refunds" ("providerRefundId") `,
    );
    await queryRunner.query(
      `ALTER TABLE "__platform_schema__"."subscription_refunds" ADD CONSTRAINT "FK_3027551699118ee1b0de8b25d2f" FOREIGN KEY ("paymentId") REFERENCES "__platform_schema__"."subscription_payments"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "__platform_schema__"."subscription_refunds" ADD CONSTRAINT "FK_2442cf12b750944970dfd578312" FOREIGN KEY ("subscriptionId") REFERENCES "__platform_schema__"."subscriptions"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await this.runDown(this.forConfiguredSchema(queryRunner));
  }

  private async runDown(queryRunner: QueryRunner): Promise<void> {
    const [{ count }] = (await queryRunner.query(
      `SELECT COUNT(*) AS "count" FROM "__platform_schema__"."subscription_refunds"`,
    )) as Array<{ count: string }>;
    if (Number(count) > 0) {
      throw new Error(
        'Unsafe rollback refused: subscription_refunds contains durable refund records',
      );
    }

    await queryRunner.query(
      `ALTER TABLE "__platform_schema__"."subscription_refunds" DROP CONSTRAINT "FK_2442cf12b750944970dfd578312"`,
    );
    await queryRunner.query(
      `ALTER TABLE "__platform_schema__"."subscription_refunds" DROP CONSTRAINT "FK_3027551699118ee1b0de8b25d2f"`,
    );
    await queryRunner.query(
      `DROP INDEX "__platform_schema__"."IDX_bc30ef57f41b59d3f6e955afc9"`,
    );
    await queryRunner.query(
      `DROP INDEX "__platform_schema__"."IDX_54f731c88aad9c3de2bd95537a"`,
    );
    await queryRunner.query(
      `DROP INDEX "__platform_schema__"."IDX_2442cf12b750944970dfd57831"`,
    );
    await queryRunner.query(
      `DROP INDEX "__platform_schema__"."IDX_3027551699118ee1b0de8b25d2"`,
    );
    await queryRunner.query(
      `DROP TABLE "__platform_schema__"."subscription_refunds"`,
    );
    await queryRunner.query(
      `DROP TYPE "__platform_schema__"."subscription_refunds_status_enum"`,
    );

    await queryRunner.query(
      `ALTER TYPE "__platform_schema__"."subscription_payments_status_enum" RENAME TO "subscription_payments_status_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "__platform_schema__"."subscription_payments_status_enum" AS ENUM('CANCELED', 'PENDING', 'UNPAID', 'PAID', 'PARTIALLY_REFUNDED', 'REFUNDED', 'FAILED')`,
    );
    await queryRunner.query(
      `ALTER TABLE "__platform_schema__"."subscription_payments" ALTER COLUMN "status" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "__platform_schema__"."subscription_payments" ALTER COLUMN "status" TYPE "__platform_schema__"."subscription_payments_status_enum" USING "status"::text::"__platform_schema__"."subscription_payments_status_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "__platform_schema__"."subscription_payments" ALTER COLUMN "status" SET DEFAULT 'UNPAID'`,
    );
    await queryRunner.query(
      `DROP TYPE "__platform_schema__"."subscription_payments_status_enum_old"`,
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
