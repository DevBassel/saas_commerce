import { Injectable } from '@nestjs/common';
import { RbacService } from '../../rbac/rbac.service';
import { CreatePermissionDto } from '../../rbac/dto/create-permission.dto';
import { UpdatePermissionDto } from '../../rbac/dto/update-permission.dto';
import {
  PlatformTenantRefService,
  TenantRef,
} from '../common/tenant-ref.service';

@Injectable()
export class PlatformPermissionsService {
  constructor(
    private readonly tenantRefService: PlatformTenantRefService,
    private readonly rbacService: RbacService,
  ) {}

  private tenantRef(tenantId: number): Promise<TenantRef> {
    return this.tenantRefService.resolve(tenantId);
  }

  async listTenantPermissions(tenantId: number) {
    return this.rbacService.findAllPermissions(await this.tenantRef(tenantId));
  }

  async createTenantPermission(tenantId: number, dto: CreatePermissionDto) {
    return this.rbacService.createPermission(
      dto,
      await this.tenantRef(tenantId),
    );
  }

  async updateTenantPermission(
    tenantId: number,
    permissionId: number,
    dto: UpdatePermissionDto,
  ) {
    return this.rbacService.updatePermission(
      permissionId,
      dto,
      await this.tenantRef(tenantId),
    );
  }

  async removeTenantPermission(tenantId: number, permissionId: number) {
    return this.rbacService.removePermission(
      permissionId,
      await this.tenantRef(tenantId),
    );
  }
}
