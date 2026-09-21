import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { Tenant } from '../src/modules/tenants/entities/tenant.entity';
import { TenantManagerService } from '../src/modules/tenants/tenant-manager.service';
import { IAPP, IENV } from '../src/common/config/env.interface';

const SLUG_A = 'verify-life-a';
const SLUG_B = 'verify-life-b';

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
  const base = `${(await app.getUrl()).replace(/\/$/, '')}/api/v1`;

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

  const json = async <T>(res: { json: () => Promise<unknown> }): Promise<T> =>
    (await res.json()) as T;

  try {
    await cleanup();

    const platformLoginEarly = await fetch(`${base}/auth/login/platform`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        email: process.env.BOOTSTRAP_SUPER_ADMIN_EMAIL,
        password: process.env.BOOTSTRAP_SUPER_ADMIN_PASSWORD,
      }),
    });
    const platformEarlyBody = await json<{ access_token: string }>(
      platformLoginEarly,
    );
    assert(platformLoginEarly.status === 200, `platform login (early) -> 200`);

    const registerStore = async (slug: string, email: string) => {
      const res = await fetch(`${base}/auth/register-store`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${platformEarlyBody.access_token}`,
        },
        body: JSON.stringify({
          name: `Owner ${slug}`,
          email,
          password: 'password123',
          storeName: `Store ${slug}`,
          storeSlug: slug,
          subdomain: slug,
        }),
      });
      const body = await json<{ access_token: string }>(res);
      assert(res.status === 201, `register-store ${slug} -> 201`);
      return body.access_token;
    };

    const tokenA = await registerStore(SLUG_A, 'owner-a@life.test');
    const tokenB = await registerStore(SLUG_B, 'owner-b@life.test');

    const authed = (token: string, slug: string) => ({
      authorization: `Bearer ${token}`,
      'x-tenant-slug': slug,
    });

    const login = await fetch(`${base}/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-tenant-slug': SLUG_A },
      body: JSON.stringify({
        email: 'owner-a@life.test',
        password: 'password123',
      }),
    });
    assert(login.status === 200, `login tenant A -> 200`);

    const registerCustomer = await fetch(`${base}/auth/register`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-tenant-slug': SLUG_A },
      body: JSON.stringify({
        name: 'Customer A',
        email: 'customer-a@life.test',
        password: 'password123',
      }),
    });
    assert(registerCustomer.status === 201, `register customer A -> 201`);

    const usersA = await fetch(`${base}/users`, {
      headers: authed(tokenA, SLUG_A),
    });
    const listA = await json<{ id: number; email: string }[]>(usersA);
    assert(usersA.status === 200, `list users A -> 200`);
    assert(
      listA.some((u) => u.email === 'customer-a@life.test'),
      `tenant A list contains its customer`,
    );

    const roleRes = await fetch(`${base}/roles`, {
      method: 'POST',
      headers: {
        ...authed(tokenA, SLUG_A),
        'content-type': 'application/json',
      },
      body: JSON.stringify({ key: 'auditor', name: 'Auditor' }),
    });
    const role = await json<{ id: number; key: string }>(roleRes);
    assert(roleRes.status === 201, `create role A -> 201`);

    const rolesA = await fetch(`${base}/roles`, {
      headers: authed(tokenA, SLUG_A),
    });
    const rolesAJson = await json<{ key: string }[]>(rolesA);
    assert(
      rolesAJson.some((r) => r.key === 'auditor'),
      `tenant A roles include custom auditor`,
    );
    assert(
      !rolesAJson.some((r) => r.key === 'SUPER_ADMIN'),
      `tenant A roles exclude SUPER_ADMIN`,
    );

    const permsBefore = await json<{ id: number; key: string }[]>(
      await fetch(`${base}/permissions`, { headers: authed(tokenA, SLUG_A) }),
    );
    const seeded = permsBefore.find((p) => p.key === 'permissions:read')!;
    assert(Boolean(seeded), `tenant A seeded permissions readable`);

    const delPerm = await fetch(`${base}/permissions/${seeded.id}`, {
      method: 'DELETE',
      headers: authed(tokenA, SLUG_A),
    });
    assert(delPerm.status === 204, `delete permission A -> 204`);

    const permRes = await fetch(`${base}/permissions`, {
      method: 'POST',
      headers: {
        ...authed(tokenA, SLUG_A),
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        key: 'permissions:read',
        name: 'Read permissions (recreated)',
      }),
    });
    const perm = await json<{ id: number; key: string }>(permRes);
    assert(permRes.status === 201, `create permission A -> 201`);

    const updatePerm = await fetch(`${base}/permissions/${perm.id}`, {
      method: 'PATCH',
      headers: {
        ...authed(tokenA, SLUG_A),
        'content-type': 'application/json',
      },
      body: JSON.stringify({ name: 'Read permissions (updated)' }),
    });
    assert(updatePerm.status === 200, `update permission A -> 200`);

    const customer = listA.find((u) => u.email === 'customer-a@life.test')!;
    const assignRole = await fetch(`${base}/users/${customer.id}/role`, {
      method: 'PATCH',
      headers: {
        ...authed(tokenA, SLUG_A),
        'content-type': 'application/json',
      },
      body: JSON.stringify({ roleId: role.id }),
    });
    assert(assignRole.status === 200, `assign role to customer -> 200`);

    const grantPerm = await fetch(`${base}/users/${customer.id}/permissions`, {
      method: 'POST',
      headers: {
        ...authed(tokenA, SLUG_A),
        'content-type': 'application/json',
      },
      body: JSON.stringify({ permissionIds: [perm.id] }),
    });
    assert(grantPerm.status === 201, `grant permission to customer -> 201`);

    const listB = await json<{ email: string }[]>(
      await fetch(`${base}/users`, { headers: authed(tokenB, SLUG_B) }),
    );
    assert(
      !listB.some((u) => u.email === 'owner-a@life.test'),
      `tenant B list excludes tenant A users`,
    );

    const config = app.get(ConfigService<IENV>);
    const { bootstrapSuperAdminEmail, bootstrapSuperAdminPassword } =
      config.getOrThrow<IAPP>('app');

    const platformLogin = await fetch(`${base}/auth/login/platform`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        email: bootstrapSuperAdminEmail,
        password: bootstrapSuperAdminPassword,
      }),
    });
    const platformBody = await json<{ access_token: string }>(platformLogin);
    assert(platformLogin.status === 200, `login/platform -> 200`);

    const tenants = await json<{ slug: string }[]>(
      await fetch(`${base}/platform/tenants`, {
        headers: { authorization: `Bearer ${platformBody.access_token}` },
      }),
    );
    assert(
      tenants.some((t) => t.slug === SLUG_A) &&
        tenants.some((t) => t.slug === SLUG_B),
      `platform lists both tenants`,
    );

    console.log('VERIFY TENANT LIFECYCLE: PASS');
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
