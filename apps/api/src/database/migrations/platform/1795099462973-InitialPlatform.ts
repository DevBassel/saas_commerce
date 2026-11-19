import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialPlatform1795099462973 implements MigrationInterface {
  name = 'InitialPlatform1795099462973';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await this.runUp(this.forConfiguredSchema(queryRunner));
  }

  private async runUp(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
    await queryRunner.query(
      `CREATE TABLE "__platform_schema__"."permissions" ("id" SERIAL NOT NULL, "key" character varying NOT NULL, "name" character varying NOT NULL, "description" character varying, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_920331560282b8bd21bb02290df" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_017943867ed5ceef9c03edd974" ON "__platform_schema__"."permissions" ("key") `,
    );
    await queryRunner.query(
      `CREATE TABLE "__platform_schema__"."roles" ("id" SERIAL NOT NULL, "key" character varying NOT NULL, "name" character varying NOT NULL, "description" character varying, "isSystem" boolean NOT NULL DEFAULT false, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_c1433d71a4838793a49dcad46ab" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_a87cf0659c3ac379b339acf36a" ON "__platform_schema__"."roles" ("key") `,
    );
    await queryRunner.query(
      `CREATE TABLE "__platform_schema__"."user" ("id" SERIAL NOT NULL, "name" character varying NOT NULL, "email" character varying NOT NULL, "password" character varying NOT NULL, "roleId" integer, "emailVerified" boolean NOT NULL DEFAULT false, "jti" character varying, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_cace4a159ff9f2512dd42373760" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_e12875dfb3b1d92d7d7c5377e2" ON "__platform_schema__"."user" ("email") `,
    );
    await queryRunner.query(
      `CREATE TYPE "__platform_schema__"."currency_change_requests_status_enum" AS ENUM('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "__platform_schema__"."currency_change_requests" ("id" SERIAL NOT NULL, "tenantId" integer NOT NULL, "requestedById" integer, "requestedByEmail" character varying, "currentCurrency" character varying(3) NOT NULL, "requestedCurrency" character varying(3) NOT NULL, "status" "__platform_schema__"."currency_change_requests_status_enum" NOT NULL DEFAULT 'PENDING', "reason" character varying(500), "reviewNote" character varying(500), "reviewedById" integer, "reviewedAt" TIMESTAMP WITH TIME ZONE, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_d66894cd0a3e95a7d3da105537f" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_faba4cd2fedecb2b00f5c6a49d" ON "__platform_schema__"."currency_change_requests" ("tenantId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_f5db68ae35ac8df11f1aefc67c" ON "__platform_schema__"."currency_change_requests" ("status") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_currency_change_requests_pending_tenant" ON "__platform_schema__"."currency_change_requests" ("tenantId") WHERE "status" = 'PENDING'`,
    );
    await queryRunner.query(
      `CREATE TABLE "__platform_schema__"."stripe_webhook_events" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "stripeEventId" character varying(255) NOT NULL, "eventType" character varying(128) NOT NULL, "resourceId" character varying(255), "stripeCreatedAt" TIMESTAMP WITH TIME ZONE NOT NULL, "payload" jsonb NOT NULL, "status" character varying(16) NOT NULL DEFAULT 'PENDING', "attempts" integer NOT NULL DEFAULT '0', "processingStartedAt" TIMESTAMP WITH TIME ZONE, "processingToken" character varying(64), "processedAt" TIMESTAMP WITH TIME ZONE, "failedAt" TIMESTAMP WITH TIME ZONE, "nextRetryAt" TIMESTAMP WITH TIME ZONE, "lastError" text, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "CHK_stripe_webhook_events_status" CHECK ("status" IN ('PENDING', 'PROCESSING', 'PROCESSED', 'FAILED')), CONSTRAINT "PK_0cf13fd3f2ff5604e092bc1ff48" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_stripe_webhook_events_retry" ON "__platform_schema__"."stripe_webhook_events" ("status", "nextRetryAt") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_stripe_webhook_events_resource_created" ON "__platform_schema__"."stripe_webhook_events" ("resourceId", "stripeCreatedAt") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_stripe_webhook_events_event_id" ON "__platform_schema__"."stripe_webhook_events" ("stripeEventId") `,
    );
    await queryRunner.query(
      `CREATE TYPE "__platform_schema__"."tenants_status_enum" AS ENUM('active', 'inactive')`,
    );
    await queryRunner.query(
      `CREATE TABLE "__platform_schema__"."tenants" ("id" SERIAL NOT NULL, "name" character varying NOT NULL, "slug" character varying NOT NULL, "schemaName" character varying NOT NULL, "subdomain" character varying, "status" "__platform_schema__"."tenants_status_enum" NOT NULL DEFAULT 'inactive', "ownerUserId" integer, "storageUsedBytes" bigint NOT NULL DEFAULT '0', "storageCapacityBytes" bigint NOT NULL, "stripeAccountId" character varying, "paymentsPaused" boolean NOT NULL DEFAULT false, "payoutsPaused" boolean NOT NULL DEFAULT false, "stripePayoutsInterval" character varying, "currency" character varying(3) NOT NULL DEFAULT 'usd', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_ea40b8fac8272b10d6dd9f15f5f" UNIQUE ("stripeAccountId"), CONSTRAINT "PK_53be67a04681c66b87ee27c9321" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_2310ecc5cb8be427097154b18f" ON "__platform_schema__"."tenants" ("slug") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_fae19dfc02d10ccce4412abb39" ON "__platform_schema__"."tenants" ("schemaName") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_21bb89e012fa5b58532009c160" ON "__platform_schema__"."tenants" ("subdomain") `,
    );
    await queryRunner.query(
      `CREATE TYPE "__platform_schema__"."subscription_plan_limits_type_enum" AS ENUM('BYTES', 'COUNT')`,
    );
    await queryRunner.query(
      `CREATE TABLE "__platform_schema__"."subscription_plan_limits" ("id" SERIAL NOT NULL, "planId" integer NOT NULL, "key" character varying(64) NOT NULL, "value" bigint, "type" "__platform_schema__"."subscription_plan_limits_type_enum" NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_e3240c1955c44b2dfc7500276da" UNIQUE ("planId", "key"), CONSTRAINT "PK_31ccd1f13380390629211d51cde" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "__platform_schema__"."subscription_plan_features" ("id" SERIAL NOT NULL, "planId" integer NOT NULL, "key" character varying(64) NOT NULL, "enabled" boolean NOT NULL DEFAULT true, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_87d234e6e96ee17133c243c8aa9" UNIQUE ("planId", "key"), CONSTRAINT "PK_d9ee0b915953daf576ad8e57e26" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "__platform_schema__"."subscription_plans" ("id" SERIAL NOT NULL, "name" character varying(120) NOT NULL, "slug" character varying(80) NOT NULL, "description" text, "monthlyPrice" numeric(10,2) NOT NULL DEFAULT '0', "yearlyPrice" numeric(10,2) NOT NULL DEFAULT '0', "currency" character varying(3) NOT NULL DEFAULT 'usd', "active" boolean NOT NULL DEFAULT true, "public" boolean NOT NULL DEFAULT true, "sortOrder" integer NOT NULL DEFAULT '0', "trialDays" integer NOT NULL DEFAULT '0', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_9ab8fe6918451ab3d0a4fb6bb0c" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_0ebf9b0f0cbd7b2fb5b62e3fac" ON "__platform_schema__"."subscription_plans" ("slug") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_a119d12fb1daa9ac517698864a" ON "__platform_schema__"."subscription_plans" ("active") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_f9cc4556cd4a88e5ea0fa33826" ON "__platform_schema__"."subscription_plans" ("public") `,
    );
    await queryRunner.query(
      `CREATE TYPE "__platform_schema__"."subscriptions_status_enum" AS ENUM('TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELED', 'UNPAID', 'INCOMPLETE', 'INCOMPLETE_EXPIRED', 'PAUSED')`,
    );
    await queryRunner.query(
      `CREATE TYPE "__platform_schema__"."subscriptions_billinginterval_enum" AS ENUM('MONTHLY', 'YEARLY')`,
    );
    await queryRunner.query(
      `CREATE TABLE "__platform_schema__"."subscriptions" ("id" SERIAL NOT NULL, "tenantId" integer NOT NULL, "planId" integer NOT NULL, "status" "__platform_schema__"."subscriptions_status_enum" NOT NULL DEFAULT 'ACTIVE', "billingInterval" "__platform_schema__"."subscriptions_billinginterval_enum" NOT NULL DEFAULT 'MONTHLY', "currentPeriodStart" TIMESTAMP, "currentPeriodEnd" TIMESTAMP, "trialStart" TIMESTAMP, "trialEnd" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_a87248d73155605cf782be9ee5e" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_0c5fe8e5f9f4dd4a8c0134abc9" ON "__platform_schema__"."subscriptions" ("tenantId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_7536cba909dd7584a4640cad7d" ON "__platform_schema__"."subscriptions" ("planId") `,
    );
    await queryRunner.query(
      `CREATE TYPE "__platform_schema__"."subscription_payments_billinginterval_enum" AS ENUM('MONTHLY', 'YEARLY')`,
    );
    await queryRunner.query(
      `CREATE TYPE "__platform_schema__"."subscription_payments_provider_enum" AS ENUM('stripe', 'paypal')`,
    );
    await queryRunner.query(
      `CREATE TYPE "__platform_schema__"."subscription_payments_status_enum" AS ENUM('CANCELED', 'PENDING', 'UNPAID', 'PAID', 'PARTIALLY_REFUNDED', 'REFUNDED', 'FAILED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "__platform_schema__"."subscription_payments" ("id" SERIAL NOT NULL, "subscriptionId" integer NOT NULL, "planId" integer NOT NULL, "billingInterval" "__platform_schema__"."subscription_payments_billinginterval_enum" NOT NULL DEFAULT 'MONTHLY', "provider" "__platform_schema__"."subscription_payments_provider_enum" NOT NULL, "status" "__platform_schema__"."subscription_payments_status_enum" NOT NULL DEFAULT 'UNPAID', "amount" numeric(10,2) NOT NULL, "currency" character varying NOT NULL, "paymentRef" character varying, "providerReference" character varying, "refundReference" character varying, "refundedAmount" numeric(10,2) NOT NULL DEFAULT '0', "failureReason" character varying, "paidAt" TIMESTAMP, "refundedAt" TIMESTAMP, "planAppliedAt" TIMESTAMP, "refundDowngradedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_1b7a76365fd477de59cba0ab957" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_b71c34361d0308a49ceed66d63" ON "__platform_schema__"."subscription_payments" ("subscriptionId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_16c9a77415f8ee621578d1f545" ON "__platform_schema__"."subscription_payments" ("planId") `,
    );
    await queryRunner.query(
      `CREATE TABLE "__platform_schema__"."tenant_usage_counters" ("id" SERIAL NOT NULL, "tenantId" integer NOT NULL, "metric" character varying(64) NOT NULL, "periodStart" date NOT NULL, "used" integer NOT NULL DEFAULT '0', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_1cbe3de60ae94fce03640682e52" UNIQUE ("tenantId", "metric", "periodStart"), CONSTRAINT "PK_ecf5752d30d49223c18ffea8dbf" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_a50907285fe9bb089375db3d33" ON "__platform_schema__"."tenant_usage_counters" ("tenantId") `,
    );
    await queryRunner.query(
      `CREATE TABLE "__platform_schema__"."role_permissions" ("rolesId" integer NOT NULL, "permissionsId" integer NOT NULL, CONSTRAINT "PK_7931614007a93423204b4b73240" PRIMARY KEY ("rolesId", "permissionsId"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_0cb93c5877d37e954e2aa59e52" ON "__platform_schema__"."role_permissions" ("rolesId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_d422dabc78ff74a8dab6583da0" ON "__platform_schema__"."role_permissions" ("permissionsId") `,
    );
    await queryRunner.query(
      `CREATE TABLE "__platform_schema__"."user_permissions" ("userId" integer NOT NULL, "permissionsId" integer NOT NULL, CONSTRAINT "PK_f0aed043ca20329d6d61f4c6dea" PRIMARY KEY ("userId", "permissionsId"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_f05ccc7935f14874d7f89ba030" ON "__platform_schema__"."user_permissions" ("userId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_d68e45e4cd82c8fa4730e30cac" ON "__platform_schema__"."user_permissions" ("permissionsId") `,
    );
    await queryRunner.query(
      `ALTER TABLE "__platform_schema__"."user" ADD CONSTRAINT "FK_c28e52f758e7bbc53828db92194" FOREIGN KEY ("roleId") REFERENCES "__platform_schema__"."roles"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "__platform_schema__"."subscription_plan_limits" ADD CONSTRAINT "FK_9c9d2547f085546170e6ea5642b" FOREIGN KEY ("planId") REFERENCES "__platform_schema__"."subscription_plans"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "__platform_schema__"."subscription_plan_features" ADD CONSTRAINT "FK_eebde20dc0ea854cd3632ece39e" FOREIGN KEY ("planId") REFERENCES "__platform_schema__"."subscription_plans"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "__platform_schema__"."subscriptions" ADD CONSTRAINT "FK_0c5fe8e5f9f4dd4a8c0134abc9c" FOREIGN KEY ("tenantId") REFERENCES "__platform_schema__"."tenants"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "__platform_schema__"."subscriptions" ADD CONSTRAINT "FK_7536cba909dd7584a4640cad7d5" FOREIGN KEY ("planId") REFERENCES "__platform_schema__"."subscription_plans"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "__platform_schema__"."subscription_payments" ADD CONSTRAINT "FK_b71c34361d0308a49ceed66d63b" FOREIGN KEY ("subscriptionId") REFERENCES "__platform_schema__"."subscriptions"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "__platform_schema__"."role_permissions" ADD CONSTRAINT "FK_0cb93c5877d37e954e2aa59e52c" FOREIGN KEY ("rolesId") REFERENCES "__platform_schema__"."roles"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "__platform_schema__"."role_permissions" ADD CONSTRAINT "FK_d422dabc78ff74a8dab6583da02" FOREIGN KEY ("permissionsId") REFERENCES "__platform_schema__"."permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "__platform_schema__"."user_permissions" ADD CONSTRAINT "FK_f05ccc7935f14874d7f89ba030f" FOREIGN KEY ("userId") REFERENCES "__platform_schema__"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "__platform_schema__"."user_permissions" ADD CONSTRAINT "FK_d68e45e4cd82c8fa4730e30cacd" FOREIGN KEY ("permissionsId") REFERENCES "__platform_schema__"."permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await this.runDown(this.forConfiguredSchema(queryRunner));
  }

  private async runDown(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "__platform_schema__"."user_permissions" DROP CONSTRAINT "FK_d68e45e4cd82c8fa4730e30cacd"`,
    );
    await queryRunner.query(
      `ALTER TABLE "__platform_schema__"."user_permissions" DROP CONSTRAINT "FK_f05ccc7935f14874d7f89ba030f"`,
    );
    await queryRunner.query(
      `ALTER TABLE "__platform_schema__"."role_permissions" DROP CONSTRAINT "FK_d422dabc78ff74a8dab6583da02"`,
    );
    await queryRunner.query(
      `ALTER TABLE "__platform_schema__"."role_permissions" DROP CONSTRAINT "FK_0cb93c5877d37e954e2aa59e52c"`,
    );
    await queryRunner.query(
      `ALTER TABLE "__platform_schema__"."subscription_payments" DROP CONSTRAINT "FK_b71c34361d0308a49ceed66d63b"`,
    );
    await queryRunner.query(
      `ALTER TABLE "__platform_schema__"."subscriptions" DROP CONSTRAINT "FK_7536cba909dd7584a4640cad7d5"`,
    );
    await queryRunner.query(
      `ALTER TABLE "__platform_schema__"."subscriptions" DROP CONSTRAINT "FK_0c5fe8e5f9f4dd4a8c0134abc9c"`,
    );
    await queryRunner.query(
      `ALTER TABLE "__platform_schema__"."subscription_plan_features" DROP CONSTRAINT "FK_eebde20dc0ea854cd3632ece39e"`,
    );
    await queryRunner.query(
      `ALTER TABLE "__platform_schema__"."subscription_plan_limits" DROP CONSTRAINT "FK_9c9d2547f085546170e6ea5642b"`,
    );
    await queryRunner.query(
      `ALTER TABLE "__platform_schema__"."user" DROP CONSTRAINT "FK_c28e52f758e7bbc53828db92194"`,
    );
    await queryRunner.query(
      `DROP INDEX "__platform_schema__"."IDX_d68e45e4cd82c8fa4730e30cac"`,
    );
    await queryRunner.query(
      `DROP INDEX "__platform_schema__"."IDX_f05ccc7935f14874d7f89ba030"`,
    );
    await queryRunner.query(
      `DROP TABLE "__platform_schema__"."user_permissions"`,
    );
    await queryRunner.query(
      `DROP INDEX "__platform_schema__"."IDX_d422dabc78ff74a8dab6583da0"`,
    );
    await queryRunner.query(
      `DROP INDEX "__platform_schema__"."IDX_0cb93c5877d37e954e2aa59e52"`,
    );
    await queryRunner.query(
      `DROP TABLE "__platform_schema__"."role_permissions"`,
    );
    await queryRunner.query(
      `DROP INDEX "__platform_schema__"."IDX_a50907285fe9bb089375db3d33"`,
    );
    await queryRunner.query(
      `DROP TABLE "__platform_schema__"."tenant_usage_counters"`,
    );
    await queryRunner.query(
      `DROP INDEX "__platform_schema__"."IDX_16c9a77415f8ee621578d1f545"`,
    );
    await queryRunner.query(
      `DROP INDEX "__platform_schema__"."IDX_b71c34361d0308a49ceed66d63"`,
    );
    await queryRunner.query(
      `DROP TABLE "__platform_schema__"."subscription_payments"`,
    );
    await queryRunner.query(
      `DROP TYPE "__platform_schema__"."subscription_payments_status_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE "__platform_schema__"."subscription_payments_provider_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE "__platform_schema__"."subscription_payments_billinginterval_enum"`,
    );
    await queryRunner.query(
      `DROP INDEX "__platform_schema__"."IDX_7536cba909dd7584a4640cad7d"`,
    );
    await queryRunner.query(
      `DROP INDEX "__platform_schema__"."IDX_0c5fe8e5f9f4dd4a8c0134abc9"`,
    );
    await queryRunner.query(`DROP TABLE "__platform_schema__"."subscriptions"`);
    await queryRunner.query(
      `DROP TYPE "__platform_schema__"."subscriptions_billinginterval_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE "__platform_schema__"."subscriptions_status_enum"`,
    );
    await queryRunner.query(
      `DROP INDEX "__platform_schema__"."IDX_f9cc4556cd4a88e5ea0fa33826"`,
    );
    await queryRunner.query(
      `DROP INDEX "__platform_schema__"."IDX_a119d12fb1daa9ac517698864a"`,
    );
    await queryRunner.query(
      `DROP INDEX "__platform_schema__"."IDX_0ebf9b0f0cbd7b2fb5b62e3fac"`,
    );
    await queryRunner.query(
      `DROP TABLE "__platform_schema__"."subscription_plans"`,
    );
    await queryRunner.query(
      `DROP TABLE "__platform_schema__"."subscription_plan_features"`,
    );
    await queryRunner.query(
      `DROP TABLE "__platform_schema__"."subscription_plan_limits"`,
    );
    await queryRunner.query(
      `DROP TYPE "__platform_schema__"."subscription_plan_limits_type_enum"`,
    );
    await queryRunner.query(
      `DROP INDEX "__platform_schema__"."IDX_21bb89e012fa5b58532009c160"`,
    );
    await queryRunner.query(
      `DROP INDEX "__platform_schema__"."IDX_fae19dfc02d10ccce4412abb39"`,
    );
    await queryRunner.query(
      `DROP INDEX "__platform_schema__"."IDX_2310ecc5cb8be427097154b18f"`,
    );
    await queryRunner.query(`DROP TABLE "__platform_schema__"."tenants"`);
    await queryRunner.query(
      `DROP TYPE "__platform_schema__"."tenants_status_enum"`,
    );
    await queryRunner.query(
      `DROP INDEX "__platform_schema__"."UQ_stripe_webhook_events_event_id"`,
    );
    await queryRunner.query(
      `DROP INDEX "__platform_schema__"."IDX_stripe_webhook_events_resource_created"`,
    );
    await queryRunner.query(
      `DROP INDEX "__platform_schema__"."IDX_stripe_webhook_events_retry"`,
    );
    await queryRunner.query(
      `DROP TABLE "__platform_schema__"."stripe_webhook_events"`,
    );
    await queryRunner.query(
      `DROP INDEX "__platform_schema__"."UQ_currency_change_requests_pending_tenant"`,
    );
    await queryRunner.query(
      `DROP INDEX "__platform_schema__"."IDX_f5db68ae35ac8df11f1aefc67c"`,
    );
    await queryRunner.query(
      `DROP INDEX "__platform_schema__"."IDX_faba4cd2fedecb2b00f5c6a49d"`,
    );
    await queryRunner.query(
      `DROP TABLE "__platform_schema__"."currency_change_requests"`,
    );
    await queryRunner.query(
      `DROP TYPE "__platform_schema__"."currency_change_requests_status_enum"`,
    );
    await queryRunner.query(
      `DROP INDEX "__platform_schema__"."IDX_e12875dfb3b1d92d7d7c5377e2"`,
    );
    await queryRunner.query(`DROP TABLE "__platform_schema__"."user"`);
    await queryRunner.query(
      `DROP INDEX "__platform_schema__"."IDX_a87cf0659c3ac379b339acf36a"`,
    );
    await queryRunner.query(`DROP TABLE "__platform_schema__"."roles"`);
    await queryRunner.query(
      `DROP INDEX "__platform_schema__"."IDX_017943867ed5ceef9c03edd974"`,
    );
    await queryRunner.query(`DROP TABLE "__platform_schema__"."permissions"`);
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
