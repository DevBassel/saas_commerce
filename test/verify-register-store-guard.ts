import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { Tenant } from '../src/modules/tenants/entities/tenant.entity';
import { TenantManagerService } from '../src/modules/tenants/tenant-manager.service';

const SLUG = 'verify-regstore-guard';
const SLUG_TENANT = 'verify-regstore-tenant';

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
    for (const slug of [SLUG, SLUG_TENANT]) {
      const schema = `tenant_${slug}`.replace(/[^a-z0-9_]/g, '_');
      await manager.release({ schemaName: schema });
      await publicDs.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    }
    await publicDs
      .getRepository(Tenant)
      .delete([{ slug: SLUG }, { slug: SLUG_TENANT }]);
  };

  try {
    await cleanup();

    const anonymous = await fetch(`${base}/auth/register-store`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(storePayload(SLUG)),
    });
    assert(anonymous.status === 401, `anonymous register-store -> 401`);

    const platformEmail = process.env.BOOTSTRAP_SUPER_ADMIN_EMAIL;
    const platformPassword = process.env.BOOTSTRAP_SUPER_ADMIN_PASSWORD;
    assert(Boolean(platformEmail && platformPassword), 'bootstrap creds set');

    const platformLogin = await fetch(`${base}/auth/login/platform`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        email: platformEmail,
        password: platformPassword,
      }),
    });
    const platformBody = (await platformLogin.json()) as {
      access_token?: string;
    };
    assert(platformLogin.status === 200, 'platform login -> 200');
    const platformToken = platformBody.access_token as string;

    const created = await fetch(`${base}/auth/register-store`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${platformToken}`,
      },
      body: JSON.stringify(storePayload(SLUG)),
    });
    const createdBody = (await created.json()) as { access_token?: string };
    if (created.status !== 201)
      console.log('  register-store response:', created.status, createdBody);
    assert(created.status === 201, 'platform register-store -> 201');
    const tenantOwnerToken = createdBody.access_token as string;

    const tenantAttempt = await fetch(`${base}/auth/register-store`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${tenantOwnerToken}`,
      },
      body: JSON.stringify(storePayload(SLUG_TENANT)),
    });
    assert(
      tenantAttempt.status === 403,
      `tenant STORE_OWNER register-store -> 403`,
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
