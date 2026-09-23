import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Tenant } from '../entities/tenant.entity';
import { TenantManagerService } from './tenant-manager.service';
import { TENANT_ROLE_KEYS, seedRbac } from '../../rbac/rbac.seed';
import { seedCategories } from '../../categories/categories.seed';
import { sanitizeSchemaName } from '../tenant.utils';

@Injectable()
export class TenantProvisionerService {
  private readonly logger = new Logger(TenantProvisionerService.name);

  constructor(
    private readonly manager: TenantManagerService,
    @InjectDataSource() private readonly publicDataSource: DataSource,
  ) {}

  async provision(tenant: Tenant): Promise<DataSource> {
    const schema = sanitizeSchemaName(tenant.schemaName);

    await this.publicDataSource.query(
      `CREATE SCHEMA IF NOT EXISTS "${schema}"`,
    );

    const ds = await this.manager.getDataSource({ schemaName: schema });

    await seedRbac(ds, { roles: TENANT_ROLE_KEYS });
    await seedCategories(ds);

    this.logger.log(`Provisioned tenant ${tenant.slug} (schema ${schema})`);
    return ds;
  }
}
