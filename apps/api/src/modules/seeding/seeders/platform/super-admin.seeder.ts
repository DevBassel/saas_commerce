import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IAPP, IENV } from 'src/common/config/env.interface';
import { ensureBootstrapSuperAdmin } from '../../helpers/rbac.seed';
import { SeederOrder } from '../../constants/seeding.constants';
import {
  PlatformSeeder,
  SeederContext,
} from '../../interfaces/seeder.interface';

@Injectable()
export class SuperAdminSeeder implements PlatformSeeder {
  readonly name = 'super-admin';
  readonly order = SeederOrder.SUPER_ADMIN;

  private readonly logger = new Logger(SuperAdminSeeder.name);

  constructor(private readonly config: ConfigService<IENV>) {}

  async run(context: SeederContext): Promise<void> {
    const {
      bootstrapSuperAdminEmail,
      bootstrapSuperAdminPassword,
      bootstrapSuperAdminName,
    } = this.config.getOrThrow<IAPP>('app');
    const { rounds } = this.config.getOrThrow<IENV['bcrypt']>('bcrypt');

    await ensureBootstrapSuperAdmin(context.dataSource, {
      email: bootstrapSuperAdminEmail,
      password: bootstrapSuperAdminPassword,
      name: bootstrapSuperAdminName,
      rounds: rounds || 12,
    });

    this.logger.log('Ensured bootstrap super admin');
  }
}
