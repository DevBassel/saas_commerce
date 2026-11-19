import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Tenant } from '../entities/tenant.entity';
import { TenantManagerService } from './tenant-manager.service';
import { TENANT_ROLE_KEYS, seedRbac } from '../../seeding/helpers/rbac.seed';
import { sanitizeSchemaName } from '../utils/tenant.utils';
import { TenantMigrationService } from './tenant-migration.service';

@Injectable()
export class TenantProvisionerService {
  private readonly logger = new Logger(TenantProvisionerService.name);

  constructor(
    private readonly manager: TenantManagerService,
    private readonly migrations: TenantMigrationService,
  ) {}

  async createSchema(tenant: Tenant): Promise<void> {
    const schema = sanitizeSchemaName(tenant.schemaName);
    await this.migrations.ensureSchema(schema);
    this.logger.log(`Created tenant schema ${schema}`);
  }

  async migrate(tenant: Tenant): Promise<DataSource> {
    const schema = sanitizeSchemaName(tenant.schemaName);
    await this.migrations.migrate(schema);
    const dataSource = await this.manager.getDataSource({ schemaName: schema });
    this.logger.log(`Migrated tenant ${tenant.slug} (schema ${schema})`);
    return dataSource;
  }

  async seed(tenant: Tenant, dataSource?: DataSource): Promise<DataSource> {
    const schema = sanitizeSchemaName(tenant.schemaName);
    const target =
      dataSource ?? (await this.manager.getDataSource({ schemaName: schema }));
    await seedRbac(target, { roles: TENANT_ROLE_KEYS });
    this.logger.log(`Seeded tenant ${tenant.slug} (schema ${schema})`);
    return target;
  }

  async provision(tenant: Tenant): Promise<DataSource> {
    await this.createSchema(tenant);
    const dataSource = await this.migrate(tenant);
    await this.seed(tenant, dataSource);
    this.logger.log(
      `Provisioned tenant ${tenant.slug} (schema ${tenant.schemaName})`,
    );
    return dataSource;
  }
}
