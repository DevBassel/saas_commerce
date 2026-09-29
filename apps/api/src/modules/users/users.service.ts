import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { Repository, In, FindOptionsWhere } from 'typeorm';
import { Role } from '../rbac/entities/role.entity';
import { Permission } from '../rbac/entities/permission.entity';
import { mergePermissions } from '../rbac/permission.utils';
import { SEED_ROLE_PERMISSIONS } from '../rbac/constants/seed-data';
import { RoleKey, ROLE_RANK } from '../../common/constants/RoleKey.enum';
import { TenantManagerService } from '../tenants/services/tenant-manager.service';
import { tenantRefFromContext } from '../auth/tenant-context';
import { TenantRef } from '../tenants/tenant.utils';
import { IENV } from '../../common/config/env.interface';
import bcrypt from 'bcrypt';

type FindOneOptions = { withRole?: boolean; withPermissions?: boolean };

const ASSIGNABLE_ROLE_KEYS: RoleKey[] = [
  RoleKey.CUSTOMER,
  RoleKey.STORE_OWNER,
  RoleKey.ADMIN,
];

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(Role) private readonly roleRepo: Repository<Role>,
    @InjectRepository(Permission)
    private readonly permissionRepo: Repository<Permission>,
    private readonly tenantManager: TenantManagerService,
    private readonly config: ConfigService<IENV>,
  ) {}

  private buildWhere({
    id,
    email,
  }: {
    id?: number;
    email?: string;
  }): FindOptionsWhere<User> {
    if (id != null) return { id };
    if (email != null) return { email };
    throw new BadRequestException('Either id or email must be provided');
  }

  private async repos(tenant?: TenantRef): Promise<{
    userRepo: Repository<User>;
    roleRepo: Repository<Role>;
    permissionRepo: Repository<Permission>;
  }> {
    const target = tenant ?? tenantRefFromContext();

    if (!target) throw new ForbiddenException('Tenant context is required');

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

    createUserDto.password = await bcrypt.hash(
      createUserDto.password,
      this.config.getOrThrow<IENV['bcrypt']>('bcrypt').rounds,
    );
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
    const { userRepo } = await this.repos(tenant);
    return this.findOneFromRepo(userRepo, { id, email }, options);
  }

  async findOnePublic(
    { id, email }: { id?: number; email?: string },
    options: FindOneOptions = {},
  ) {
    return this.findOneFromRepo(this.userRepo, { id, email }, options);
  }

  private findOneFromRepo(
    userRepo: Repository<User>,
    { id, email }: { id?: number; email?: string },
    options: FindOneOptions = {},
  ) {
    const relations = {
      role: { permissions: true },
      ...(options.withPermissions ? { permissions: true } : {}),
    };

    return userRepo.findOne({
      where: this.buildWhere({ id, email }),
      relations,
    });
  }

  async update(
    id: number,
    updateUserDto: UpdateUserDto,
    actorRoleKey?: RoleKey,
    tenant?: TenantRef,
  ) {
    const { userRepo } = await this.repos(tenant);
    const user = await this.findOne({ id }, { withRole: true }, tenant);
    if (!user) throw new NotFoundException();
    this.assertActorCanManage(actorRoleKey, user);
    await userRepo.update({ id }, updateUserDto);
    return this.findOne({ id }, {}, tenant);
  }

  async updateSession(id: number, jti: string | null, tenant?: TenantRef) {
    const { userRepo } = await this.repos(tenant);
    await userRepo.update({ id }, { jti } as never);
  }

  async clearSession(id: number, tenant?: TenantRef) {
    await this.updateSession(id, null, tenant);
  }

  async updateSessionPublic(id: number, jti: string | null) {
    await this.userRepo.update({ id }, { jti } as never);
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

  private assertActorCanManage(
    actorRoleKey: RoleKey | undefined,
    target: User,
  ) {
    if (!actorRoleKey) return;
    const targetRoleKey = (target.role?.key ?? RoleKey.CUSTOMER) as RoleKey;
    this.assertCanAssignToUser(actorRoleKey, targetRoleKey);
  }

  async remove(id: number, actorRoleKey?: RoleKey, tenant?: TenantRef) {
    const { userRepo } = await this.repos(tenant);
    const user = await this.findOne({ id }, { withRole: true }, tenant);
    if (!user) throw new NotFoundException('User not found');
    this.assertActorCanManage(actorRoleKey, user);
    return userRepo.delete({ id });
  }
}
