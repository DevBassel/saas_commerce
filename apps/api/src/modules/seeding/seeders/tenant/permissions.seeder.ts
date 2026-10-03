import { Injectable, Logger } from '@nestjs/common';
import { SEED_PERMISSIONS } from 'src/modules/rbac/constants/seed-data';
import { upsertPermissions } from '../../helpers/rbac.seed';
import { SeederOrder } from '../../constants/seeding.constants';
import {
  TenantSeeder,
  TenantSeederContext,
} from '../../interfaces/tenant-seeder.interface';

@Injectable()
export class TenantPermissionsSeeder implements TenantSeeder {
  readonly name = 'permissions';
  readonly order = SeederOrder.PERMISSIONS;

  private readonly logger = new Logger(TenantPermissionsSeeder.name);

  async run(context: TenantSeederContext): Promise<void> {
    await upsertPermissions(context.dataSource);
    this.logger.log(
      `Seeded ${SEED_PERMISSIONS.length} permissions for ${context.tenant.slug}`,
    );
  }
}
