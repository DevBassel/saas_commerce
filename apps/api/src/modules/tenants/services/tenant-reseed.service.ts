import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { TenantService } from '../tenant.service';
import { TenantManagerService } from './tenant-manager.service';
import { TENANT_ROLE_KEYS, seedRbac } from '../../rbac/rbac.seed';
import { seedCategories } from '../../categories/categories.seed';
import { TenantStatus } from '../enums/tenantStatus.enum';

@Injectable()
export class TenantReseedService implements OnApplicationBootstrap {
  private readonly logger = new Logger(TenantReseedService.name);

  constructor(
    private readonly tenantService: TenantService,
    private readonly tenantManager: TenantManagerService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const tenants = await this.tenantService.findAll();
    const active = tenants.filter(
      (tenant) => tenant.status === TenantStatus.ACTIVE,
    );
    if (active.length === 0) return;

    this.logger.log(
      `Re-seeding ${active.length} tenant schema(s) (synchronize + rbac backfill)`,
    );

    for (const tenant of active) {
      try {
        const ds = await this.tenantManager.getDataSource(tenant);
        await seedRbac(ds, { roles: TENANT_ROLE_KEYS });
        await seedCategories(ds);
      } catch (error) {
        this.logger.error(
          `Failed to re-seed tenant ${tenant.slug} (${tenant.schemaName}): ${String(error)}`,
        );
      }
    }
  }
}
