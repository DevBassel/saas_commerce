import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { TenantManagerService } from '../src/modules/tenants/tenant-manager.service';

async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  const publicDs = app.get(DataSource);
  const manager = app.get(TenantManagerService);

  const schemas: { schema_name: string }[] = await publicDs.query(
    `SELECT schema_name FROM information_schema.schemata WHERE schema_name LIKE 'tenant\\_%'`,
  );

  for (const { schema_name } of schemas) {
    await manager.release({ schemaName: schema_name });
    await publicDs.query(`DROP SCHEMA IF EXISTS "${schema_name}" CASCADE`);
    console.log(`dropped schema ${schema_name}`);
  }

  await publicDs.query('TRUNCATE TABLE tenants RESTART IDENTITY CASCADE');
  await publicDs.query(
    'TRUNCATE TABLE user_permissions, "user", roles, permissions RESTART IDENTITY CASCADE',
  );
  console.log('truncated public tenants + auth tables');

  await app.close();
  console.log('DEV DB RESET: DONE (restart app to re-bootstrap SUPER_ADMIN)');
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
