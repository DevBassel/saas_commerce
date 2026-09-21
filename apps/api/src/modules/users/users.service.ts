import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { Repository, In } from 'typeorm';
import { Role } from '../rbac/entities/role.entity';
import { Permission } from '../rbac/entities/permission.entity';
import { mergePermissions } from '../rbac/permission.utils';
import { SEED_ROLE_PERMISSIONS } from '../rbac/constants/seed-data';
import { RoleKey, ROLE_RANK } from '../../common/constants/RoleKey.enum';
import { TenantManagerService } from '../tenants/tenant-manager.service';
import { tenantRefFromContext } from '../auth/tenant-context';
import { TenantRef } from '../tenants/tenant.utils';
import bcrypt from 'bcrypt';

type FindOneOptions = { withRole?: boolean; withPermissions?: boolean };

const ASSIGNABLE_ROLE_KEYS: RoleKey[] = [
  RoleKey.CUSTOMER,
  RoleKey.STORE_OWNER,
  RoleKey.ADMIN,
];

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(Role) private readonly roleRepo: Repository<Role>,
    @InjectRepository(Permission)
    private readonly permissionRepo: Repository<Permission>,
    private readonly tenantManager: TenantManagerService,
  ) {}

  private async repos(tenant?: TenantRef): Promise<{
    userRepo: Repository<User>;
    roleRepo: Repository<Role>;
    permissionRepo: Repository<Permission>;
  }> {
    const target = tenant ?? tenantRefFromContext();

    if (!target) {
      this.logger.warn(
        'UsersService: no tenant resolved; using public schema repositories',
      );
      return {
        userRepo: this.userRepo,
        roleRepo: this.roleRepo,
        permissionRepo: this.permissionRepo,
      };
    }

    const [userRepo, roleRepo, permissionRepo] = await Promise.all([
      this.tenantManager.getRepository(User, target),
      this.tenantManager.getRepository(Role, target),
      this.tenantManager.getRepository(Permission, target),
    ]);

    return { userRepo, roleRepo, permissionRepo };
  }

  async create(
    createUserDto: CreateUserDto,
    roleKey: RoleKey = RoleKey.CUSTOMER,
    tenant?: TenantRef,
  ) {
    if (roleKey === RoleKey.SUPER_ADMIN)
      throw new ForbiddenException('You are not allowed to create super admin');
    if (!ASSIGNABLE_ROLE_KEYS.includes(roleKey))
      throw new BadRequestException('Role cannot be assigned');

    const { userRepo, roleRepo, permissionRepo } = await this.repos(tenant);

    const existing = await this.findOne(
      { email: createUserDto.email },
      {},
      tenant,
    );
    if (existing) throw new BadRequestException('user already exists');

    const role = await roleRepo.findOneBy({ key: roleKey });
    if (!role) throw new BadRequestException('role not seeded');

    const permissionKeys = SEED_ROLE_PERMISSIONS[roleKey] ?? [];
    const permissions = permissionKeys.length
      ? await permissionRepo.findBy({ key: In(permissionKeys) })
      : [];

    createUserDto.password = await bcrypt.hash(createUserDto.password, 12);
    return await userRepo.save(
      userRepo.create({
        ...createUserDto,
        roleId: role.id,
        permissions,
      }),
    );
  }

  async findAll(tenant?: TenantRef) {
    const { userRepo } = await this.repos(tenant);
    return userRepo.find({ relations: { role: true, permissions: true } });
  }

  async findOne(
    { id, email }: { id?: number; email?: string },
    options: FindOneOptions = {},
    tenant?: TenantRef,
  ) {
    const relations = {
      role: { permissions: true },
      ...(options.withPermissions ? { permissions: true } : {}),
    };

    const { userRepo } = await this.repos(tenant);

    return userRepo.findOne({
      where: [{ id }, { email }],
      relations,
    });
  }

  async update(id: number, updateUserDto: UpdateUserDto, tenant?: TenantRef) {
    const { userRepo } = await this.repos(tenant);
    const user = await this.findOne({ id }, {}, tenant);
    if (!user) throw new NotFoundException();
    await userRepo.update({ id }, updateUserDto);
    return this.findOne({ id }, {}, tenant);
  }

  async updateSession(id: number, jti: string, tenant?: TenantRef) {
    const { userRepo } = await this.repos(tenant);
    await userRepo.update({ id }, { jti });
  }

  async assignRole(
    id: number,
    roleId: number,
    actorRoleKey: RoleKey,
    tenant?: TenantRef,
  ) {
    const { userRepo, roleRepo, permissionRepo } = await this.repos(tenant);
    const user = await this.findOne({ id }, {}, tenant);
    if (!user) throw new NotFoundException('User not found');

    const role = await roleRepo.findOneBy({ id: roleId });
    if (!role) throw new NotFoundException('Role not found');

    this.assertCanAssignToUser(actorRoleKey, role.key as RoleKey);

    const permissionKeys = SEED_ROLE_PERMISSIONS[role.key as RoleKey] ?? [];
    const permissions = permissionKeys.length
      ? await permissionRepo.findBy({ key: In(permissionKeys) })
      : [];

    const loaded = await userRepo.findOne({
      where: { id },
      relations: { permissions: true },
    });
    if (!loaded) throw new NotFoundException('User not found');

    loaded.roleId = role.id;
    loaded.permissions = permissions;
    await userRepo.save(loaded);

    return this.findOne(
      { id },
      { withRole: true, withPermissions: true },
      tenant,
    );
  }

  async deassignRole(id: number, actorRoleKey: RoleKey, tenant?: TenantRef) {
    const { userRepo } = await this.repos(tenant);
    const user = await this.findOne({ id }, {}, tenant);
    if (!user) throw new NotFoundException('User not found');

    const targetRoleKey = (user.role?.key ?? RoleKey.CUSTOMER) as RoleKey;
    this.assertCanAssignToUser(actorRoleKey, targetRoleKey);

    await userRepo.update({ id }, { roleId: null });
    return this.findOne({ id }, { withRole: true }, tenant);
  }

  async grantPermissions(
    id: number,
    permissionIds: number[],
    actorRoleKey: RoleKey,
    actorPermissions: string[],
    tenant?: TenantRef,
  ) {
    const { userRepo, permissionRepo } = await this.repos(tenant);
    const user = await this.findOne({ id }, { withRole: true }, tenant);
    if (!user) throw new NotFoundException('User not found');

    const permissions = await permissionRepo.findBy({
      id: In(permissionIds),
    });
    if (permissions.length !== permissionIds.length)
      throw new BadRequestException('One or more permissions not found');

    const targetRoleKey = (user.role?.key ?? RoleKey.CUSTOMER) as RoleKey;
    this.assertCanAssignToUser(actorRoleKey, targetRoleKey);

    const bypassesOwnership = [
      RoleKey.SUPER_ADMIN,
      RoleKey.STORE_OWNER,
    ].includes(actorRoleKey);
    if (!bypassesOwnership) {
      const owned = new Set(actorPermissions);
      const unowned = permissions.find((p) => !owned.has(p.key));
      if (unowned)
        throw new ForbiddenException(
          `You cannot grant permission you do not own: ${unowned.key}`,
        );
    }

    const loaded = await userRepo.findOne({
      where: { id },
      relations: { permissions: true },
    });
    if (!loaded) throw new NotFoundException('User not found');

    loaded.permissions = mergePermissions(loaded.permissions, permissions);
    await userRepo.save(loaded);

    return this.findOne(
      { id },
      { withRole: true, withPermissions: true },
      tenant,
    );
  }

  async revokePermissions(
    id: number,
    permissionIds: number[],
    actorRoleKey: RoleKey,
    tenant?: TenantRef,
  ) {
    const { userRepo } = await this.repos(tenant);
    const user = await this.findOne({ id }, { withRole: true }, tenant);
    if (!user) throw new NotFoundException('User not found');

    const targetRoleKey = (user.role?.key ?? RoleKey.CUSTOMER) as RoleKey;
    this.assertCanAssignToUser(actorRoleKey, targetRoleKey);

    const loaded = await userRepo.findOne({
      where: { id },
      relations: { permissions: true },
    });
    if (!loaded) throw new NotFoundException('User not found');

    const remove = new Set(permissionIds);
    loaded.permissions = permissionIds.length
      ? (loaded.permissions ?? []).filter((p) => !remove.has(p.id))
      : [];
    await userRepo.save(loaded);

    return this.findOne(
      { id },
      { withRole: true, withPermissions: true },
      tenant,
    );
  }

  private assertCanAssignToUser(actorRoleKey: RoleKey, targetRoleKey: RoleKey) {
    const actorRank = ROLE_RANK[actorRoleKey] ?? 0;
    const targetRank = ROLE_RANK[targetRoleKey] ?? 0;

    const topActor = actorRoleKey === RoleKey.SUPER_ADMIN;
    const allowed = topActor ? targetRank <= actorRank : targetRank < actorRank;

    if (!allowed)
      throw new ForbiddenException(
        'You cannot modify role or permissions of a user with equal or higher rank',
      );
  }

  async remove(id: number, tenant?: TenantRef) {
    const { userRepo } = await this.repos(tenant);
    return userRepo.delete({ id });
  }
}
