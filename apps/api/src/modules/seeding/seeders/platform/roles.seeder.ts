import { Injectable, Logger } from '@nestjs/common';
import { RoleKey } from 'src/common/constants/RoleKey.enum';
import { upsertRoles } from '../../helpers/rbac.seed';
import { SeederOrder } from '../../constants/seeding.constants';
import {
  PlatformSeeder,
  SeederContext,
} from '../../interfaces/seeder.interface';

@Injectable()
export class PlatformRolesSeeder implements PlatformSeeder {
  readonly name = 'roles';
  readonly order = SeederOrder.ROLES;

  private readonly logger = new Logger(PlatformRolesSeeder.name);

  async run(context: SeederContext): Promise<void> {
    await context.dataSource.transaction(async (manager) => {
      await upsertRoles(manager, [RoleKey.SUPER_ADMIN]);
    });
    this.logger.log('Seeded SUPER_ADMIN role with permissions');
  }
}
