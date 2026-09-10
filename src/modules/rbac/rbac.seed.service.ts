import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Not, Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Role } from './entities/role.entity';
import { Permission } from './entities/permission.entity';
import { User } from '../users/entities/user.entity';
import { SEED_PERMISSIONS, SEED_ROLES } from './constants/seed-data';
import { RoleKey } from 'src/common/constants/RoleKey.enum';
import { IAPP, IENV } from 'src/common/config/env.interface';
import bcrypt from 'bcrypt';

@Injectable()
export class RbacSeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger(RbacSeedService.name);

  constructor(
    @InjectRepository(Role) private readonly roleRepo: Repository<Role>,
    @InjectRepository(Permission)
    private readonly permissionRepo: Repository<Permission>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    private readonly config: ConfigService<IENV>,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.seed();
  }

  async seed(): Promise<void> {
    for (const perm of SEED_PERMISSIONS) {
      const entity = await this.permissionRepo.findOneBy({ key: perm.key });
      if (!entity) {
        await this.permissionRepo.save(this.permissionRepo.create(perm));
      }
    }
    this.logger.log(`Seeded ${SEED_PERMISSIONS.length} permissions`);

    for (const roleSeed of SEED_ROLES) {
      let role = await this.roleRepo.findOneBy({ key: roleSeed.key });
      if (!role) {
        role = this.roleRepo.create({
          key: roleSeed.key,
          name: roleSeed.name,
          description: roleSeed.description,
        });
      } else {
        role.name = roleSeed.name;
        role.description = roleSeed.description;
      }
      await this.roleRepo.save(role);
    }
    this.logger.log(`Seeded ${SEED_ROLES.length} roles`);

    await this.normalizeUsersToSystemRole();
    await this.purgeStaleRoles();
    await this.ensureSuperAdmin();
    await this.bootstrapStoreOwner();
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
        const merged = new Map<number, Permission>();
        for (const p of loaded.permissions ?? []) merged.set(p.id, p);
        for (const p of permissions) merged.set(p.id, p);
        loaded.permissions = [...merged.values()];
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

  private async normalizeUsersToSystemRole(): Promise<void> {
    const customerRole = await this.roleRepo.findOneBy({
      key: RoleKey.CUSTOMER,
    });
    if (!customerRole) return;

    const activeKeys = Object.values(RoleKey);

    const stale = await this.userRepo
      .createQueryBuilder('user')
      .leftJoin('user.role', 'role')
      .where('user.roleId IS NULL')
      .orWhere('role.key NOT IN (:...activeKeys)', { activeKeys })
      .getMany();

    if (!stale.length) return;

    await this.userRepo.update(
      { id: In(stale.map((u) => u.id)) },
      { roleId: customerRole.id },
    );
    this.logger.log(`Assigned CUSTOMER role to ${stale.length} stale users`);
  }

  private async purgeStaleRoles(): Promise<void> {
    const activeKeys = Object.values(RoleKey);

    const staleRoles = await this.roleRepo.findBy({
      key: Not(In(activeKeys)),
    });

    if (!staleRoles.length) return;

    const staleIds = staleRoles.map((r) => r.id);
    const stillReferenced = await this.userRepo.countBy({
      roleId: In(staleIds),
    });
    if (stillReferenced > 0) {
      this.logger.warn(
        `Skip purge: ${stillReferenced} user(s) still reference stale roles`,
      );
      return;
    }

    await this.roleRepo.delete({ id: In(staleIds) });
    this.logger.log(`Purged ${staleRoles.length} stale roles`);
  }

  private async bootstrapStoreOwner(): Promise<void> {
    const { bootstrapStoreOwnerEmail } = this.config.getOrThrow<IAPP>('app');
    if (!bootstrapStoreOwnerEmail) return;

    const ownerRole = await this.roleRepo.findOneBy({
      key: RoleKey.STORE_OWNER,
    });
    if (!ownerRole) return;

    const user = await this.userRepo.findOneBy({
      email: bootstrapStoreOwnerEmail,
    });
    if (!user) return;

    if (user.roleId === ownerRole.id) return;

    await this.userRepo.update({ id: user.id }, { roleId: ownerRole.id });
    this.logger.log(
      `Granted STORE_OWNER role to bootstrap user ${bootstrapStoreOwnerEmail}`,
    );
  }
}
