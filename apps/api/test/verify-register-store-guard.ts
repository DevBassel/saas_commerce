import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { Tenant } from '../src/modules/tenants/entities/tenant.entity';
import { TenantManagerService } from '../src/modules/tenants/tenant-manager.service';

const SLUG = 'verify-regstore-guard';

const assert = (cond: unknown, msg: string): void => {
  if (!cond) throw new Error(`ASSERT FAILED: ${msg}`);
  console.log(`  ok - ${msg}`);
};

const storePayload = (slug: string) => ({
  name: 'Guard Owner',
  email: `owner-${slug}@regstore.test`,
  password: 'password123',
  storeName: `Store ${slug}`,
  storeSlug: slug,
  subdomain: slug,
});

async function main(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn'],
  });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
  app.setGlobalPrefix('api/v1');
  await app.listen(0);

  const publicDs = app.get(DataSource);
  const manager = app.get(TenantManagerService);
  const base = `${await app.getUrl()}/api/v1`;

  const cleanup = async (): Promise<void> => {
    const schema = `tenant_${SLUG}`.replace(/[^a-z0-9_]/g, '_');
    await manager.release({ schemaName: schema });
    await publicDs.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await publicDs.getRepository(Tenant).delete([{ slug: SLUG }]);
  };

  try {
    await cleanup();

    const created = await fetch(`${base}/auth/register-store`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(storePayload(SLUG)),
    });
    const createdBody = (await created.json()) as {
      access_token?: string;
    };
    if (created.status !== 201)
      console.log('  register-store response:', created.status, createdBody);
    assert(
      created.status === 201,
      'anonymous register-store (self-serve) -> 201',
    );
    const ownerToken = createdBody.access_token as string;

    const profile = await fetch(`${base}/users/profile`, {
      headers: {
        'x-tenant-slug': SLUG,
        authorization: `Bearer ${ownerToken}`,
      },
    });
    assert(profile.status === 200, 'owner token reads tenant profile -> 200');

    const platformRoute = await fetch(`${base}/platform/tenants`, {
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    assert(
      platformRoute.status === 403,
      'tenant owner token on platform route -> 403',
    );

    console.log('VERIFY REGISTER-STORE GUARD: PASS');
  } finally {
    await cleanup();
    await app.close();
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
