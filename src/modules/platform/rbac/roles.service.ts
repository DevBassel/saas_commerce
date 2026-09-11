import { Injectable } from '@nestjs/common';
import { RbacService } from '../../rbac/rbac.service';
import { CreateRoleDto } from '../../rbac/dto/create-role.dto';
import { UpdateRoleDto } from '../../rbac/dto/update-role.dto';
import {
  PlatformTenantRefService,
  TenantRef,
} from '../common/tenant-ref.service';

@Injectable()
export class PlatformRolesService {
  constructor(
    private readonly tenantRefService: PlatformTenantRefService,
    private readonly rbacService: RbacService,
  ) {}

  private tenantRef(tenantId: number): Promise<TenantRef> {
    return this.tenantRefService.resolve(tenantId);
  }

  async listTenantRoles(tenantId: number) {
    return this.rbacService.findAllRoles(await this.tenantRef(tenantId));
  }

  async getTenantRole(tenantId: number, roleId: number) {
    return this.rbacService.findRoleById(
      roleId,
      await this.tenantRef(tenantId),
    );
  }

  async createTenantRole(tenantId: number, dto: CreateRoleDto) {
    return this.rbacService.createRole(dto, await this.tenantRef(tenantId));
  }

  async updateTenantRole(tenantId: number, roleId: number, dto: UpdateRoleDto) {
    return this.rbacService.updateRole(
      roleId,
      dto,
      await this.tenantRef(tenantId),
    );
  }

  async removeTenantRole(tenantId: number, roleId: number) {
    return this.rbacService.removeRole(roleId, await this.tenantRef(tenantId));
  }
}
