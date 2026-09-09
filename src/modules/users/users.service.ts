import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { Repository, In } from 'typeorm';
import { Role } from '../rbac/entities/role.entity';
import { Permission } from '../rbac/entities/permission.entity';
import { RoleKey, ROLE_RANK } from '../../common/constants/RoleKey.enum';
import bcrypt from 'bcrypt';

type FindOneOptions = { withRole?: boolean; withPermissions?: boolean };

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(Role) private readonly roleRepo: Repository<Role>,
    @InjectRepository(Permission)
    private readonly permissionRepo: Repository<Permission>,
  ) {}

  async create(
    createUserDto: CreateUserDto,
    roleKey: RoleKey = RoleKey.CUSTOMER,
  ) {
    if (![RoleKey.CUSTOMER, RoleKey.STORE_OWNER].includes(roleKey)) {
      throw new BadRequestException('Role cannot be assigned on signup');
    }

    const existing = await this.findOne({ email: createUserDto.email });
    if (existing) throw new BadRequestException('user already exists');

    const role = await this.roleRepo.findOneBy({ key: roleKey });
    if (!role) throw new BadRequestException('role not seeded');

    createUserDto.password = await bcrypt.hash(createUserDto.password, 12);
    return await this.userRepo.save({
      ...createUserDto,
      roleId: role.id,
    });
  }

  findAll() {
    return this.userRepo.find({ relations: { role: true } });
  }

  findAllStoreOwners() {
    return this.userRepo
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.role', 'role')
      .where('role.key = :key', { key: RoleKey.STORE_OWNER })
      .getMany();
  }

  async findStoreOwnerById(id: number) {
    const user = await this.userRepo
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.role', 'role')
      .where('user.id = :id', { id })
      .andWhere('role.key = :key', { key: RoleKey.STORE_OWNER })
      .getOne();
    if (!user) throw new NotFoundException('Store not found');
    return user;
  }

  findOne(
    { id, email }: { id?: number; email?: string },
    options: FindOneOptions = {},
  ) {
    const relations = {
      role: { permissions: true },
      ...(options.withPermissions ? { permissions: true } : {}),
    };

    return this.userRepo.findOne({
      where: [{ id }, { email }],
      relations,
    });
  }

  async update(id: number, updateUserDto: UpdateUserDto) {
    const user = await this.findOne({ id });
    if (!user) throw new NotFoundException();
    await this.userRepo.update({ id }, updateUserDto);
    return this.findOne({ id });
  }

  async assignRole(id: number, roleId: number, actorRoleKey: RoleKey) {
    const user = await this.findOne({ id });
    if (!user) throw new NotFoundException('User not found');

    const role = await this.roleRepo.findOneBy({ id: roleId });
    if (!role) throw new NotFoundException('Role not found');

    this.assertCanAssignToUser(actorRoleKey, role.key as RoleKey);

    await this.userRepo.update({ id }, { roleId: role.id });
    return this.findOne({ id }, { withRole: true });
  }

  async deassignRole(id: number, actorRoleKey: RoleKey) {
    const user = await this.findOne({ id });
    if (!user) throw new NotFoundException('User not found');

    const targetRoleKey = (user.role?.key ?? RoleKey.CUSTOMER) as RoleKey;
    this.assertCanAssignToUser(actorRoleKey, targetRoleKey);

    await this.userRepo.update({ id }, { roleId: null });
    return this.findOne({ id }, { withRole: true });
  }

  async assignPermissions(
    id: number,
    permissionIds: number[],
    actorRoleKey: RoleKey,
    actorPermissions: string[],
  ) {
    const user = await this.findOne({ id }, { withRole: true });
    if (!user) throw new NotFoundException('User not found');

    const permissions = await this.permissionRepo.findBy({
      id: In(permissionIds),
    });
    if (permissions.length !== permissionIds.length)
      throw new BadRequestException('One or more permissions not found');

    const targetRoleKey = (user.role?.key ?? RoleKey.CUSTOMER) as RoleKey;
    this.assertCanAssignToUser(actorRoleKey, targetRoleKey);

    if (actorRoleKey !== RoleKey.SUPER_ADMIN) {
      const owned = new Set(actorPermissions);
      const unowned = permissions.find((p) => !owned.has(p.key));
      if (unowned)
        throw new ForbiddenException(
          `You cannot grant permission you do not own: ${unowned.key}`,
        );
    }

    const loaded = await this.userRepo.findOne({
      where: { id },
      relations: { permissions: true },
    });
    if (!loaded) throw new NotFoundException('User not found');

    loaded.permissions = permissions;
    await this.userRepo.save(loaded);

    return this.findOne({ id }, { withRole: true, withPermissions: true });
  }

  async clearPermissions(id: number, actorRoleKey: RoleKey) {
    const user = await this.findOne({ id }, { withRole: true });
    if (!user) throw new NotFoundException('User not found');

    const targetRoleKey = (user.role?.key ?? RoleKey.CUSTOMER) as RoleKey;
    this.assertCanAssignToUser(actorRoleKey, targetRoleKey);

    const loaded = await this.userRepo.findOne({
      where: { id },
      relations: { permissions: true },
    });
    if (!loaded) throw new NotFoundException('User not found');

    loaded.permissions = [];
    await this.userRepo.save(loaded);

    return this.findOne({ id }, { withRole: true, withPermissions: true });
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

  remove(id: number) {
    return this.userRepo.delete({ id });
  }
}
