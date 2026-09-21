import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { TenantService } from '../src/modules/tenants/tenant.service';
import { TenantProvisionerService } from '../src/modules/tenants/tenant-provisioner.service';
import { TenantManagerService } from '../src/modules/tenants/tenant-manager.service';
import { Tenant } from '../src/modules/tenants/entities/tenant.entity';
import { Role } from '../src/modules/rbac/entities/role.entity';
import { Permission } from '../src/modules/rbac/entities/permission.entity';
import { RoleKey } from '../src/common/constants/RoleKey.enum';

const SLUG = 'verify-t1';
const EXPECTED_TENANT_ROLES = [
  RoleKey.STORE_OWNER,
  RoleKey.ADMIN,
  RoleKey.CUSTOMER,
];

const assert = (cond: unknown, msg: string): void => {
  if (!cond) throw new Error(`ASSERT FAILED: ${msg}`);
  console.log(`  ok - ${msg}`);
};

async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  const publicDs = app.get(DataSource);
  const tenantService = app.get(TenantService);
  const provisioner = app.get(TenantProvisionerService);
  const manager = app.get(TenantManagerService);

  let tenant = await tenantService.findBySlug(SLUG);
  if (!tenant) {
    tenant = await tenantService.create({ name: 'Verify Tenant', slug: SLUG });
  }
  const schema = tenant.schemaName;
  console.log(`tenant created: id=${tenant.id} schema=${schema}`);

  const ds = await provisioner.provision(tenant);
  assert(ds.isInitialized, 'tenant datasource initialized');

  const tables: { table_name: string }[] = await ds.query(
    `SELECT table_name FROM information_schema.tables WHERE table_schema = $1 ORDER BY table_name`,
    [schema],
  );
  const tableNames = tables.map((t) => t.table_name);
  console.log(`  tables: ${tableNames.join(', ')}`);
  for (const expected of ['user', 'roles', 'permissions', 'user_permissions']) {
    assert(tableNames.includes(expected), `schema has table ${expected}`);
  }

  const roleRepo = ds.getRepository(Role);
  const permRepo = ds.getRepository(Permission);

  const roles = await roleRepo.find();
  const roleKeys = roles.map((r) => r.key).sort();
  console.log(`  roles: ${roleKeys.join(', ')}`);
  for (const key of EXPECTED_TENANT_ROLES) {
    assert(roleKeys.includes(key), `tenant has role ${key}`);
  }
  assert(
    !roleKeys.includes(RoleKey.SUPER_ADMIN),
    'tenant has NO SUPER_ADMIN role',
  );

  const permCount = await permRepo.count();
  assert(permCount > 0, `tenant has permissions (${permCount})`);

  const second = await provisioner.provision(tenant);
  assert(second === ds, 're-provision returns cached datasource');
  assert(
    (await roleRepo.count()) === roles.length,
    're-provision is idempotent (role count unchanged)',
  );
  assert(
    (await permRepo.count()) === permCount,
    're-provision is idempotent (permission count unchanged)',
  );

  await manager.release(tenant);
  await publicDs.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
  await publicDs.getRepository(Tenant).delete({ id: tenant.id });
  console.log('cleanup done (schema dropped, tenant row deleted)');

  await app.close();
  console.log('VERIFY TENANT PROVISION: PASS');
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
