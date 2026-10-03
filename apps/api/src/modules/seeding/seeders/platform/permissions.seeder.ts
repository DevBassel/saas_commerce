import { Injectable, Logger } from '@nestjs/common';
import { SEED_PERMISSIONS } from 'src/modules/rbac/constants/seed-data';
import { upsertPermissions } from '../../helpers/rbac.seed';
import { SeederOrder } from '../../constants/seeding.constants';
import {
  PlatformSeeder,
  SeederContext,
} from '../../interfaces/seeder.interface';

@Injectable()
export class PlatformPermissionsSeeder implements PlatformSeeder {
  readonly name = 'permissions';
  readonly order = SeederOrder.PERMISSIONS;

  private readonly logger = new Logger(PlatformPermissionsSeeder.name);

  async run(context: SeederContext): Promise<void> {
    await upsertPermissions(context.dataSource);
    this.logger.log(`Seeded ${SEED_PERMISSIONS.length} permissions`);
  }
}
