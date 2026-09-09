import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Not, Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Role } from './entities/role.entity';
import { Permission } from './entities/permission.entity';
import { User } from '../users/entities/user.entity';
import { SEED_PERMISSIONS, SEED_ROLES } from './constants/seed-data';
import { PermissionKey } from 'src/common/constants/PermissionKey.enum';
import { RoleKey } from 'src/common/constants/RoleKey.enum';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { CreatePermissionDto } from './dto/create-permission.dto';
import { UpdatePermissionDto } from './dto/update-permission.dto';
import { IAPP, IENV } from 'src/common/config/env.interface';

const SYSTEM_ROLES: RoleKey[] = [
  RoleKey.SUPER_ADMIN,
  RoleKey.STORE_OWNER,
  RoleKey.ADMIN,
  RoleKey.MANAGER,
  RoleKey.EMPLOYEE,
  RoleKey.CUSTOMER,
];

@Injectable()
export class RbacService implements OnApplicationBootstrap {
  private readonly logger = new Logger(RbacService.name);

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
    const created: Permission[] = [];
    for (const perm of SEED_PERMISSIONS) {
      let entity = await this.permissionRepo.findOneBy({ key: perm.key });
      if (!entity) {
        entity = this.permissionRepo.create(perm);
        await this.permissionRepo.save(entity);
      }
      created.push(entity);
    }
    this.logger.log(`Seeded ${created.length} permissions`);

    const permissionByKey = new Map(created.map((p) => [p.key, p]));

    for (const roleSeed of SEED_ROLES) {
      let role = await this.roleRepo.findOne({
        where: { key: roleSeed.key },
        relations: { permissions: true },
      });
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
      role.permissions = roleSeed.permissionKeys
        .map((k) => permissionByKey.get(k))
        .filter((p): p is Permission => Boolean(p));
      await this.roleRepo.save(role);
    }
    this.logger.log(`Seeded ${SEED_ROLES.length} roles`);

    await this.normalizeUsersToSystemRole();
    await this.purgeStaleRoles();
    await this.bootstrapSuperAdmin();
    await this.bootstrapStoreOwner();
  }

  private async bootstrapSuperAdmin(): Promise<void> {
    const { bootstrapSuperAdminEmail } = this.config.getOrThrow<IAPP>('app');
    if (!bootstrapSuperAdminEmail) return;

    const superAdminRole = await this.roleRepo.findOneBy({
      key: RoleKey.SUPER_ADMIN,
    });
    if (!superAdminRole) return;

    const user = await this.userRepo.findOneBy({
      email: bootstrapSuperAdminEmail,
    });
    if (!user) return;

    if (user.roleId === superAdminRole.id) return;

    await this.userRepo.update({ id: user.id }, { roleId: superAdminRole.id });
    this.logger.log(
      `Granted SUPER_ADMIN role to bootstrap user ${bootstrapSuperAdminEmail}`,
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

  findAllRoles(): Promise<Role[]> {
    return this.roleRepo.find({ relations: { permissions: true } });
  }

  async findRoleById(id: number): Promise<Role> {
    const role = await this.roleRepo.findOne({
      where: { id },
      relations: { permissions: true },
    });
    if (!role) throw new NotFoundException('Role not found');
    return role;
  }

  findRoleByKey(key: RoleKey): Promise<Role | null> {
    return this.roleRepo.findOne({
      where: { key },
      relations: { permissions: true },
    });
  }

  async createRole(dto: CreateRoleDto): Promise<Role> {
    const exists = await this.roleRepo.findOneBy({ key: dto.key });
    if (exists) throw new ConflictException('Role key already exists');

    const permissions = dto.permissionKeys?.length
      ? await this.permissionRepo.findBy({ key: In(dto.permissionKeys) })
      : [];

    return this.roleRepo.save(
      this.roleRepo.create({
        key: dto.key,
        name: dto.name,
        description: dto.description,
        permissions,
      }),
    );
  }

  async updateRole(id: number, dto: UpdateRoleDto): Promise<Role> {
    const role = await this.findRoleById(id);
    if (dto.key && dto.key !== role.key) {
      const taken = await this.roleRepo.findOneBy({ key: dto.key });
      if (taken) throw new ConflictException('Role key already exists');
    }

    role.key = dto.key ?? role.key;
    role.name = dto.name ?? role.name;
    role.description = dto.description ?? role.description;

    if (dto.permissionKeys) {
      const permissions = await this.permissionRepo.findBy({
        key: In(dto.permissionKeys),
      });
      role.permissions = permissions;
    }

    return this.roleRepo.save(role);
  }

  async removeRole(id: number): Promise<void> {
    const role = await this.roleRepo.findOne({
      where: { id },
      relations: { permissions: true },
    });
    if (!role) throw new NotFoundException('Role not found');
    if (SYSTEM_ROLES.includes(role.key as RoleKey)) {
      throw new ConflictException('System roles cannot be deleted');
    }
    await this.roleRepo.delete({ id });
  }

  findAllPermissions(): Promise<Permission[]> {
    return this.permissionRepo.find({ order: { key: 'ASC' } });
  }

  async createPermission(dto: CreatePermissionDto): Promise<Permission> {
    const exists = await this.permissionRepo.findOneBy({ key: dto.key });
    if (exists) throw new ConflictException('Permission key already exists');
    return this.permissionRepo.save(this.permissionRepo.create(dto));
  }

  async updatePermission(
    id: number,
    dto: UpdatePermissionDto,
  ): Promise<Permission> {
    const permission = await this.permissionRepo.findOneBy({ id });
    if (!permission) throw new NotFoundException('Permission not found');
    if (dto.key && dto.key !== (permission.key as PermissionKey)) {
      const taken = await this.permissionRepo.findOneBy({ key: dto.key });
      if (taken) throw new ConflictException('Permission key already exists');
    }
    return this.permissionRepo.save({ ...permission, ...dto });
  }

  async removePermission(id: number): Promise<void> {
    const permission = await this.permissionRepo.findOneBy({ id });
    if (!permission) throw new NotFoundException('Permission not found');
    await this.permissionRepo.delete({ id });
  }
}
