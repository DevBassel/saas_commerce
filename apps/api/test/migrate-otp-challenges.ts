import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { Tenant } from '../src/modules/tenants/entities/tenant.entity';

/**
 * Idempotent production migration for the OTP table. Tenant schemas are created
 * from entity metadata, not migrations, so where `synchronize` is disabled in
 * production this script creates `otp_challenges` in every existing tenant
 * schema. Safe to re-run.
 *
 * Usage: npx ts-node -r tsconfig-paths/register test/migrate-otp-challenges.ts
 */
const SCHEMA_REGEX = /^[a-z0-9_]+$/;

const DDL = (schema: string): string[] => [
  `CREATE TABLE IF NOT EXISTS "${schema}"."otp_challenges" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "userId" integer NOT NULL,
    "email" character varying(320) NOT NULL,
    "purpose" character varying(32) NOT NULL,
    "codeHash" character varying(64) NOT NULL,
    "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL,
    "attempts" integer NOT NULL DEFAULT 0,
    "maxAttempts" integer NOT NULL,
    "requestCount" integer NOT NULL DEFAULT 1,
    "lastSentAt" TIMESTAMP WITH TIME ZONE,
    "consumedAt" TIMESTAMP WITH TIME ZONE,
    "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    CONSTRAINT "PK_otp_challenges" PRIMARY KEY ("id"),
    CONSTRAINT "FK_otp_challenges_user" FOREIGN KEY ("userId")
      REFERENCES "${schema}"."user"("id") ON DELETE CASCADE
  )`,
  `CREATE INDEX IF NOT EXISTS "IDX_otp_challenges_userId"
    ON "${schema}"."otp_challenges" ("userId")`,
  `CREATE INDEX IF NOT EXISTS "IDX_otp_challenges_email"
    ON "${schema}"."otp_challenges" ("email")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_otp_challenges_active"
    ON "${schema}"."otp_challenges" ("userId", "purpose")
    WHERE "consumedAt" IS NULL`,
];

async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  const publicDs = app.get(DataSource);
  const tenants = await publicDs.getRepository(Tenant).find();

  if (tenants.length === 0) console.log('no tenants found; nothing to do');

  for (const tenant of tenants) {
    const schema = tenant.schemaName;
    if (!SCHEMA_REGEX.test(schema)) {
      console.warn(`skipping unexpected schema name: ${schema}`);
      continue;
    }
    for (const statement of DDL(schema)) {
      await publicDs.query(statement);
    }
    console.log(`migrated otp_challenges in ${schema}`);
  }

  await app.close();
  console.log('MIGRATE OTP CHALLENGES: DONE');
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
