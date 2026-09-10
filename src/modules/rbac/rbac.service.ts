import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Role } from './entities/role.entity';
import { Permission } from './entities/permission.entity';
import { PermissionKey } from 'src/common/constants/PermissionKey.enum';
import { RoleKey } from 'src/common/constants/RoleKey.enum';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { CreatePermissionDto } from './dto/create-permission.dto';
import { UpdatePermissionDto } from './dto/update-permission.dto';

const SYSTEM_ROLES: RoleKey[] = [
  RoleKey.SUPER_ADMIN,
  RoleKey.STORE_OWNER,
  RoleKey.ADMIN,
  RoleKey.MANAGER,
  RoleKey.EMPLOYEE,
  RoleKey.CUSTOMER,
];

@Injectable()
export class RbacService {
  constructor(
    @InjectRepository(Role) private readonly roleRepo: Repository<Role>,
    @InjectRepository(Permission)
    private readonly permissionRepo: Repository<Permission>,
  ) {}

  findAllRoles(): Promise<Role[]> {
    return this.roleRepo.find();
  }

  async findRoleById(id: number): Promise<Role> {
    const role = await this.roleRepo.findOneBy({ id });
    if (!role) throw new NotFoundException('Role not found');
    return role;
  }

  findRoleByKey(key: RoleKey): Promise<Role | null> {
    return this.roleRepo.findOneBy({ key });
  }

  async createRole(dto: CreateRoleDto): Promise<Role> {
    const exists = await this.roleRepo.findOneBy({ key: dto.key });
    if (exists) throw new ConflictException('Role key already exists');

    return this.roleRepo.save(
      this.roleRepo.create({
        key: dto.key,
        name: dto.name,
        description: dto.description,
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

    return this.roleRepo.save(role);
  }

  async removeRole(id: number): Promise<void> {
    const role = await this.roleRepo.findOneBy({ id });
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
