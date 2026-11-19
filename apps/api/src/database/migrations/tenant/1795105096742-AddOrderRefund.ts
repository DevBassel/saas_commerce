import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddOrderRefund1795105096742 implements MigrationInterface {
  name = 'AddOrderRefund1795105096742';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await this.runUp(this.forConfiguredSchema(queryRunner));
  }

  private async runUp(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "__tenant_schema__"."orders_paymentstatus_enum" ADD VALUE 'REFUND_PENDING'`,
    );
    await queryRunner.query(
      `ALTER TYPE "__tenant_schema__"."payments_status_enum" ADD VALUE 'REFUND_PENDING'`,
    );
    await queryRunner.query(
      `CREATE TYPE "__tenant_schema__"."order_refunds_sourceorderstatus_enum" AS ENUM('PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'RETURN_REQUESTED', 'RETURNED', 'CANCELLED')`,
    );
    await queryRunner.query(
      `CREATE TYPE "__tenant_schema__"."order_refunds_targetorderstatus_enum" AS ENUM('PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'RETURN_REQUESTED', 'RETURNED', 'CANCELLED')`,
    );
    await queryRunner.query(
      `CREATE TYPE "__tenant_schema__"."order_refunds_status_enum" AS ENUM('PENDING', 'PROCESSING', 'SUCCEEDED', 'FAILED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "__tenant_schema__"."order_refunds" ("id" SERIAL NOT NULL, "paymentId" integer NOT NULL, "orderId" integer NOT NULL, "sourceOrderStatus" "__tenant_schema__"."order_refunds_sourceorderstatus_enum" NOT NULL, "targetOrderStatus" "__tenant_schema__"."order_refunds_targetorderstatus_enum" NOT NULL, "amount" numeric(10,2) NOT NULL, "currency" character varying NOT NULL, "idempotencyKey" character varying NOT NULL, "providerRefundId" character varying, "providerStatus" character varying, "status" "__tenant_schema__"."order_refunds_status_enum" NOT NULL DEFAULT 'PENDING', "attempts" integer NOT NULL DEFAULT '0', "nextRetryAt" TIMESTAMP, "lastError" text, "completedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_f8c501d1232e93e00aac466a279" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_88cde61546bc26ba1b220a03c3" ON "__tenant_schema__"."order_refunds" ("paymentId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_1d266acc6f94a5d28bf7bfa169" ON "__tenant_schema__"."order_refunds" ("orderId") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_cf7e3be63c5bad2ea88cf4d66b" ON "__tenant_schema__"."order_refunds" ("idempotencyKey") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_4de93c78a9b429f888ec181e6f" ON "__tenant_schema__"."order_refunds" ("providerRefundId") `,
    );
    await queryRunner.query(
      `ALTER TABLE "__tenant_schema__"."order_refunds" ADD CONSTRAINT "FK_88cde61546bc26ba1b220a03c3c" FOREIGN KEY ("paymentId") REFERENCES "__tenant_schema__"."payments"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "__tenant_schema__"."order_refunds" ADD CONSTRAINT "FK_1d266acc6f94a5d28bf7bfa1691" FOREIGN KEY ("orderId") REFERENCES "__tenant_schema__"."orders"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await this.runDown(this.forConfiguredSchema(queryRunner));
  }

  private async runDown(queryRunner: QueryRunner): Promise<void> {
    const [{ count }] = (await queryRunner.query(
      `SELECT COUNT(*) AS "count" FROM "__tenant_schema__"."order_refunds"`,
    )) as Array<{ count: string }>;
    if (Number(count) > 0) {
      throw new Error(
        'Unsafe rollback refused: order_refunds contains durable refund records',
      );
    }

    await queryRunner.query(
      `ALTER TABLE "__tenant_schema__"."order_refunds" DROP CONSTRAINT "FK_1d266acc6f94a5d28bf7bfa1691"`,
    );
    await queryRunner.query(
      `ALTER TABLE "__tenant_schema__"."order_refunds" DROP CONSTRAINT "FK_88cde61546bc26ba1b220a03c3c"`,
    );
    await queryRunner.query(
      `DROP INDEX "__tenant_schema__"."IDX_4de93c78a9b429f888ec181e6f"`,
    );
    await queryRunner.query(
      `DROP INDEX "__tenant_schema__"."IDX_cf7e3be63c5bad2ea88cf4d66b"`,
    );
    await queryRunner.query(
      `DROP INDEX "__tenant_schema__"."IDX_1d266acc6f94a5d28bf7bfa169"`,
    );
    await queryRunner.query(
      `DROP INDEX "__tenant_schema__"."IDX_88cde61546bc26ba1b220a03c3"`,
    );
    await queryRunner.query(`DROP TABLE "__tenant_schema__"."order_refunds"`);
    await queryRunner.query(
      `DROP TYPE "__tenant_schema__"."order_refunds_status_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE "__tenant_schema__"."order_refunds_targetorderstatus_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE "__tenant_schema__"."order_refunds_sourceorderstatus_enum"`,
    );

    await queryRunner.query(
      `ALTER TYPE "__tenant_schema__"."payments_status_enum" RENAME TO "payments_status_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "__tenant_schema__"."payments_status_enum" AS ENUM('CANCELED', 'PENDING', 'UNPAID', 'PAID', 'PARTIALLY_REFUNDED', 'REFUNDED', 'FAILED')`,
    );
    await queryRunner.query(
      `ALTER TABLE "__tenant_schema__"."payments" ALTER COLUMN "status" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "__tenant_schema__"."payments" ALTER COLUMN "status" TYPE "__tenant_schema__"."payments_status_enum" USING "status"::text::"__tenant_schema__"."payments_status_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "__tenant_schema__"."payments" ALTER COLUMN "status" SET DEFAULT 'UNPAID'`,
    );
    await queryRunner.query(
      `DROP TYPE "__tenant_schema__"."payments_status_enum_old"`,
    );

    await queryRunner.query(
      `ALTER TYPE "__tenant_schema__"."orders_paymentstatus_enum" RENAME TO "orders_paymentstatus_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "__tenant_schema__"."orders_paymentstatus_enum" AS ENUM('CANCELED', 'PENDING', 'UNPAID', 'PAID', 'PARTIALLY_REFUNDED', 'REFUNDED', 'FAILED')`,
    );
    await queryRunner.query(
      `ALTER TABLE "__tenant_schema__"."orders" ALTER COLUMN "paymentStatus" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "__tenant_schema__"."orders" ALTER COLUMN "paymentStatus" TYPE "__tenant_schema__"."orders_paymentstatus_enum" USING "paymentStatus"::text::"__tenant_schema__"."orders_paymentstatus_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "__tenant_schema__"."orders" ALTER COLUMN "paymentStatus" SET DEFAULT 'UNPAID'`,
    );
    await queryRunner.query(
      `DROP TYPE "__tenant_schema__"."orders_paymentstatus_enum_old"`,
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
