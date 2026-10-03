import { Injectable, Logger } from '@nestjs/common';
import { TENANT_ROLE_KEYS, upsertRoles } from '../../helpers/rbac.seed';
import { SeederOrder } from '../../constants/seeding.constants';
import {
  TenantSeeder,
  TenantSeederContext,
} from '../../interfaces/tenant-seeder.interface';

@Injectable()
export class TenantRolesSeeder implements TenantSeeder {
  readonly name = 'roles';
  readonly order = SeederOrder.ROLES;

  private readonly logger = new Logger(TenantRolesSeeder.name);

  async run(context: TenantSeederContext): Promise<void> {
    for (const key of TENANT_ROLE_KEYS) {
      await context.dataSource.transaction(async (manager) => {
        await upsertRoles(manager, [key]);
      });
    }
    this.logger.log(
      `Seeded ${TENANT_ROLE_KEYS.length} roles for ${context.tenant.slug}`,
    );
  }
}
