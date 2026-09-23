import {
  ConflictException,
  Injectable,
  Logger,
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
import { TenantManagerService } from '../tenants/services/tenant-manager.service';
import { tenantRefFromContext } from '../auth/tenant-context';
import { TenantRef } from '../tenants/tenant.utils';

const SYSTEM_ROLES: RoleKey[] = [
  RoleKey.SUPER_ADMIN,
  RoleKey.STORE_OWNER,
  RoleKey.ADMIN,
  RoleKey.CUSTOMER,
];

@Injectable()
export class RbacService {
  private readonly logger = new Logger(RbacService.name);

  constructor(
    @InjectRepository(Role) private readonly roleRepo: Repository<Role>,
    @InjectRepository(Permission)
    private readonly permissionRepo: Repository<Permission>,
    private readonly tenantManager: TenantManagerService,
  ) {}

  private resolveTenant(tenant?: TenantRef): TenantRef | undefined {
    return tenant ?? tenantRefFromContext();
  }

  private warnMissingTenantContext(): void {
    if (process.env.NODE_ENV === 'production') return;
    this.logger.warn(
      'RbacService: no tenant context resolved; falling back to public schema repositories',
    );
  }

  private async repos(tenant?: TenantRef): Promise<{
    roleRepo: Repository<Role>;
    permissionRepo: Repository<Permission>;
  }> {
    const target = this.resolveTenant(tenant);
    if (!target) {
      this.warnMissingTenantContext();
      return { roleRepo: this.roleRepo, permissionRepo: this.permissionRepo };
    }

    const [roleRepo, permissionRepo] = await Promise.all([
      this.tenantManager.getRepository(Role, target),
      this.tenantManager.getRepository(Permission, target),
    ]);
    return { roleRepo, permissionRepo };
  }

  async findAllRoles(tenant?: TenantRef): Promise<Role[]> {
    const { roleRepo } = await this.repos(tenant);
    return roleRepo.find();
  }

  async findRoleById(id: number, tenant?: TenantRef): Promise<Role> {
    const { roleRepo } = await this.repos(tenant);
    const role = await roleRepo.findOneBy({ id });
    if (!role) throw new NotFoundException('Role not found');
    return role;
  }

  async findRoleByKey(key: RoleKey, tenant?: TenantRef): Promise<Role | null> {
    const { roleRepo } = await this.repos(tenant);
    return roleRepo.findOneBy({ key });
  }

  async createRole(dto: CreateRoleDto, tenant?: TenantRef): Promise<Role> {
    const { roleRepo } = await this.repos(tenant);
    if (SYSTEM_ROLES.includes(dto.key as RoleKey)) {
      throw new ConflictException('Role key is reserved');
    }
    const exists = await roleRepo.findOneBy({ key: dto.key });
    if (exists) throw new ConflictException('Role key already exists');

    return roleRepo.save(
      roleRepo.create({
        key: dto.key,
        name: dto.name,
        description: dto.description,
      }),
    );
  }

  async updateRole(
    id: number,
    dto: UpdateRoleDto,
    tenant?: TenantRef,
  ): Promise<Role> {
    const { roleRepo } = await this.repos(tenant);
    const role = await this.findRoleById(id, tenant);
    if (dto.key && dto.key !== role.key) {
      if (role.isSystem) {
        throw new ConflictException('System role keys cannot be changed');
      }
      if (SYSTEM_ROLES.includes(dto.key as RoleKey)) {
        throw new ConflictException('Role key is reserved');
      }
      const taken = await roleRepo.findOneBy({ key: dto.key });
      if (taken) throw new ConflictException('Role key already exists');
    }

    role.key = dto.key ?? role.key;
    role.name = dto.name ?? role.name;
    role.description = dto.description ?? role.description;

    return roleRepo.save(role);
  }

  async removeRole(id: number, tenant?: TenantRef): Promise<void> {
    const { roleRepo } = await this.repos(tenant);
    const role = await roleRepo.findOneBy({ id });
    if (!role) throw new NotFoundException('Role not found');
    if (role.isSystem || SYSTEM_ROLES.includes(role.key as RoleKey)) {
      throw new ConflictException('System roles cannot be deleted');
    }
    await roleRepo.delete({ id });
  }

  async findAllPermissions(tenant?: TenantRef): Promise<Permission[]> {
    const { permissionRepo } = await this.repos(tenant);
    return permissionRepo.find({ order: { key: 'ASC' } });
  }

  async createPermission(
    dto: CreatePermissionDto,
    tenant?: TenantRef,
  ): Promise<Permission> {
    const { permissionRepo } = await this.repos(tenant);
    const exists = await permissionRepo.findOneBy({ key: dto.key });
    if (exists) throw new ConflictException('Permission key already exists');
    return permissionRepo.save(permissionRepo.create(dto));
  }

  async updatePermission(
    id: number,
    dto: UpdatePermissionDto,
    tenant?: TenantRef,
  ): Promise<Permission> {
    const { permissionRepo } = await this.repos(tenant);
    const permission = await permissionRepo.findOneBy({ id });
    if (!permission) throw new NotFoundException('Permission not found');
    if (dto.key && dto.key !== (permission.key as PermissionKey)) {
      const taken = await permissionRepo.findOneBy({ key: dto.key });
      if (taken) throw new ConflictException('Permission key already exists');
    }
    return permissionRepo.save({ ...permission, ...dto });
  }

  async removePermission(id: number, tenant?: TenantRef): Promise<void> {
    const { permissionRepo } = await this.repos(tenant);
    const permission = await permissionRepo.findOneBy({ id });
    if (!permission) throw new NotFoundException('Permission not found');
    await permissionRepo.delete({ id });
  }
}
