import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { Repository } from 'typeorm';
import { Role } from '../rbac/entities/role.entity';
import { RoleKey, ROLE_RANK } from '../../common/constants/RoleKey.enum';
import { ForbiddenException } from '@nestjs/common';
import bcrypt from 'bcrypt';

type FindOneOptions = { withRole?: boolean };

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(Role) private readonly roleRepo: Repository<Role>,
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
    const relations = options.withRole
      ? { role: { permissions: true } }
      : { role: true };

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

    this.assertCanAssignRole(actorRoleKey, role.key);

    await this.userRepo.update({ id }, { roleId: role.id });
    return this.findOne({ id }, { withRole: true });
  }

  private assertCanAssignRole(actorRoleKey: RoleKey, targetRoleKey: string) {
    const actorRank = ROLE_RANK[actorRoleKey] ?? 0;
    const targetRank = ROLE_RANK[targetRoleKey as RoleKey] ?? 0;

    const topActor = actorRoleKey === RoleKey.SUPER_ADMIN;
    const allowed = topActor ? targetRank <= actorRank : targetRank < actorRank;

    if (!allowed)
      throw new ForbiddenException(
        'You cannot assign a role of equal or higher rank',
      );
  }

  remove(id: number) {
    return this.userRepo.delete({ id });
  }
}
