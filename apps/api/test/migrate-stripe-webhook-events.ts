import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';

/**
 * Idempotent production migration for durable Stripe webhook processing.
 * Public schema synchronization may be disabled in production, so this script
 * creates the event inbox explicitly. Safe to re-run.
 *
 * Usage: npx ts-node -r tsconfig-paths/register test/migrate-stripe-webhook-events.ts
 */
const DDL = [
  `CREATE TABLE IF NOT EXISTS "public"."stripe_webhook_events" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "stripeEventId" character varying(255) NOT NULL,
    "eventType" character varying(128) NOT NULL,
    "resourceId" character varying(255),
    "stripeCreatedAt" TIMESTAMP WITH TIME ZONE NOT NULL,
    "payload" jsonb NOT NULL,
    "status" character varying(16) NOT NULL DEFAULT 'PENDING',
    "attempts" integer NOT NULL DEFAULT 0,
    "processingStartedAt" TIMESTAMP WITH TIME ZONE,
    "processingToken" character varying(64),
    "processedAt" TIMESTAMP WITH TIME ZONE,
    "failedAt" TIMESTAMP WITH TIME ZONE,
    "nextRetryAt" TIMESTAMP WITH TIME ZONE,
    "lastError" text,
    "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    CONSTRAINT "PK_stripe_webhook_events" PRIMARY KEY ("id")
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_stripe_webhook_events_event_id"
    ON "public"."stripe_webhook_events" ("stripeEventId")`,
  `CREATE INDEX IF NOT EXISTS "IDX_stripe_webhook_events_resource_created"
    ON "public"."stripe_webhook_events" ("resourceId", "stripeCreatedAt")`,
  `CREATE INDEX IF NOT EXISTS "IDX_stripe_webhook_events_retry"
    ON "public"."stripe_webhook_events" ("status", "nextRetryAt")`,
  `DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'CHK_stripe_webhook_events_status'
          AND conrelid = 'public.stripe_webhook_events'::regclass
      ) THEN
        ALTER TABLE "public"."stripe_webhook_events"
          ADD CONSTRAINT "CHK_stripe_webhook_events_status"
          CHECK ("status" IN ('PENDING', 'PROCESSING', 'PROCESSED', 'FAILED'));
      END IF;
    END
  $$`,
  `ALTER TABLE "public"."subscription_payments"
    ADD COLUMN IF NOT EXISTS "planAppliedAt" TIMESTAMP`,
  `UPDATE "public"."subscription_payments"
    SET "planAppliedAt" = "paidAt"
    WHERE "planAppliedAt" IS NULL
      AND "paidAt" IS NOT NULL
      AND "status" IN ('PAID', 'PARTIALLY_REFUNDED', 'REFUNDED')`,
  `ALTER TABLE "public"."subscription_payments"
    ADD COLUMN IF NOT EXISTS "refundDowngradedAt" TIMESTAMP`,
  `UPDATE "public"."subscription_payments" AS payment
    SET "refundDowngradedAt" = COALESCE(payment."refundedAt", payment."updatedAt")
    FROM "public"."subscriptions" AS subscription
    INNER JOIN "public"."subscription_plans" AS plan
      ON plan."id" = subscription."planId"
    WHERE payment."subscriptionId" = subscription."id"
      AND payment."status" = 'REFUNDED'
      AND payment."planAppliedAt" IS NOT NULL
      AND payment."refundDowngradedAt" IS NULL
      AND plan."slug" = 'free'
      AND payment."id" = (
        SELECT MAX(latest."id")
        FROM "public"."subscription_payments" AS latest
        WHERE latest."subscriptionId" = payment."subscriptionId"
          AND latest."status" = 'REFUNDED'
      )`,
  `ALTER TABLE "public"."stripe_webhook_events"
    ADD COLUMN IF NOT EXISTS "processingToken" character varying(64)`,
];

async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });
  const dataSource = app.get(DataSource);

  for (const statement of DDL) await dataSource.query(statement);

  await app.close();
  console.log('MIGRATE STRIPE WEBHOOK EVENTS: DONE');
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
