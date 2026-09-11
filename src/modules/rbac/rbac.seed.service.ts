import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Role } from './entities/role.entity';
import { Permission } from './entities/permission.entity';
import { User } from '../users/entities/user.entity';
import { seedRbac } from './rbac.seed';
import { RoleKey } from 'src/common/constants/RoleKey.enum';
import { IAPP, IENV } from 'src/common/config/env.interface';
import { mergePermissions } from './permission.utils';
import bcrypt from 'bcrypt';

@Injectable()
export class RbacSeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger(RbacSeedService.name);

  constructor(
    @InjectRepository(Role) private readonly roleRepo: Repository<Role>,
    @InjectRepository(Permission)
    private readonly permissionRepo: Repository<Permission>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly config: ConfigService<IENV>,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.seed();
  }

  async seed(): Promise<void> {
    await seedRbac(this.dataSource, { roles: [RoleKey.SUPER_ADMIN] });
    await this.ensureSuperAdmin();
  }

  private async ensureSuperAdmin(): Promise<void> {
    const superAdminRole = await this.roleRepo.findOneBy({
      key: RoleKey.SUPER_ADMIN,
    });
    if (!superAdminRole) return;

    const existingCount = await this.userRepo
      .createQueryBuilder('user')
      .leftJoin('user.role', 'role')
      .where('role.key = :key', { key: RoleKey.SUPER_ADMIN })
      .getCount();

    if (existingCount > 0) {
      this.logger.log(
        `SUPER_ADMIN exists (${existingCount}). Skip bootstrap super admin.`,
      );
      return;
    }

    const {
      bootstrapSuperAdminEmail,
      bootstrapSuperAdminPassword,
      bootstrapSuperAdminName,
    } = this.config.getOrThrow<IAPP>('app');

    if (!bootstrapSuperAdminEmail || !bootstrapSuperAdminPassword) {
      throw new Error(
        'No SUPER_ADMIN user found and BOOTSTRAP_SUPER_ADMIN_EMAIL / BOOTSTRAP_SUPER_ADMIN_PASSWORD are not set. Refusing to boot without a platform super admin.',
      );
    }

    const permissions = await this.permissionRepo.find();

    const existing = await this.userRepo.findOneBy({
      email: bootstrapSuperAdminEmail,
    });

    if (existing) {
      await this.userRepo.update(
        { id: existing.id },
        { roleId: superAdminRole.id },
      );

      const loaded = await this.userRepo.findOne({
        where: { id: existing.id },
        relations: { permissions: true },
      });
      if (loaded) {
        loaded.permissions = mergePermissions(loaded.permissions, permissions);
        await this.userRepo.save(loaded);
      }

      this.logger.log(
        `Granted SUPER_ADMIN role and ${permissions.length} permissions to existing user ${bootstrapSuperAdminEmail}`,
      );
      return;
    }

    const { rounds } = this.config.getOrThrow<IENV['bcrypt']>('bcrypt');
    const password = await bcrypt.hash(
      bootstrapSuperAdminPassword,
      rounds || 12,
    );

    const created = await this.userRepo.save(
      this.userRepo.create({
        name: bootstrapSuperAdminName ?? 'Super Admin',
        email: bootstrapSuperAdminEmail,
        password,
        emailVerified: true,
        roleId: superAdminRole.id,
        permissions,
      }),
    );

    this.logger.log(
      `Created bootstrap SUPER_ADMIN ${created.email} with ${permissions.length} permissions`,
    );
  }
}
