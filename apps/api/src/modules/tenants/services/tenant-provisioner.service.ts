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

  async provision(tenant: Tenant): Promise<DataSource> {
    const schema = sanitizeSchemaName(tenant.schemaName);

    await this.migrations.migrate(schema);

    const ds = await this.manager.getDataSource({ schemaName: schema });

    await seedRbac(ds, { roles: TENANT_ROLE_KEYS });

    this.logger.log(`Provisioned tenant ${tenant.slug} (schema ${schema})`);
    return ds;
  }
}
