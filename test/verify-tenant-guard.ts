import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { Tenant } from '../src/modules/tenants/entities/tenant.entity';
import { TenantManagerService } from '../src/modules/tenants/tenant-manager.service';

const SLUG_A = 'verify-guard-a';
const SLUG_B = 'verify-guard-b';

const assert = (cond: unknown, msg: string): void => {
  if (!cond) throw new Error(`ASSERT FAILED: ${msg}`);
  console.log(`  ok - ${msg}`);
};

async function main(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn'],
  });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
  app.setGlobalPrefix('api/v1');
  await app.listen(0);

  const publicDs = app.get(DataSource);
  const manager = app.get(TenantManagerService);
  const url = await app.getUrl();
  const base = `${url}/api/v1`;

  const cleanup = async (): Promise<void> => {
    for (const slug of [SLUG_A, SLUG_B]) {
      const schema = `tenant_${slug}`.replace(/[^a-z0-9_]/g, '_');
      await manager.release({ schemaName: schema });
      await publicDs.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    }
    await publicDs
      .getRepository(Tenant)
      .delete([{ slug: SLUG_A }, { slug: SLUG_B }]);
  };

  try {
    await cleanup();

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

    const register = async (slug: string, email: string) => {
      const res = await fetch(`${base}/auth/register-store`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${platformToken}`,
        },
        body: JSON.stringify({
          name: 'Guard Owner',
          email,
          password: 'password123',
          storeName: `Store ${slug}`,
          storeSlug: slug,
          subdomain: slug,
        }),
      });
      const body = (await res.json()) as { access_token?: string };
      assert(res.status === 201, `register-store ${slug} -> 201`);
      assert(
        Boolean(body.access_token),
        `register-store ${slug} returns token`,
      );
      return body.access_token as string;
    };

    const tokenA = await register(SLUG_A, 'owner-a@guard.test');
    await register(SLUG_B, 'owner-b@guard.test');

    const profile = (token: string, slug?: string) =>
      fetch(`${base}/users/profile`, {
        headers: {
          authorization: `Bearer ${token}`,
          ...(slug ? { 'x-tenant-slug': slug } : {}),
        },
      });

    const login = await fetch(`${base}/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-tenant-slug': SLUG_A },
      body: JSON.stringify({
        email: 'owner-a@guard.test',
        password: 'password123',
      }),
    });
    if (login.status !== 200)
      console.log('  login response:', login.status, await login.text());
    assert(login.status === 200, `tenant A login -> 200`);

    const registerUser = await fetch(`${base}/auth/register`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-tenant-slug': SLUG_A },
      body: JSON.stringify({
        name: 'Customer A',
        email: 'customer-a@guard.test',
        password: 'password123',
      }),
    });
    if (registerUser.status !== 201)
      console.log(
        '  register response:',
        registerUser.status,
        await registerUser.text(),
      );
    assert(registerUser.status === 201, `tenant A register customer -> 201`);

    const cross = await profile(tokenA, SLUG_B);
    assert(cross.status === 403, `tenant A token on tenant B -> 403`);

    const own = await profile(tokenA, SLUG_A);
    if (own.status !== 200)
      console.log('  own response:', own.status, await own.text());
    assert(own.status === 200, `tenant A token on tenant A -> 200`);

    const noHeader = await profile(tokenA);
    assert(
      noHeader.status === 400 || noHeader.status === 403,
      `tenant A token without tenant -> blocked (${noHeader.status})`,
    );

    const noToken = await fetch(`${base}/users/profile`, {
      headers: { 'x-tenant-slug': SLUG_A },
    });
    assert(noToken.status === 401, `no token -> 401`);

    console.log('VERIFY TENANT GUARD: PASS');
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
