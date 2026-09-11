import { Injectable } from '@nestjs/common';
import { TenantService } from '../../tenants/tenant.service';
import { TenantRef } from '../../tenants/tenant.utils';

export type { TenantRef };

@Injectable()
export class PlatformTenantRefService {
  constructor(private readonly tenantService: TenantService) {}

  async resolve(tenantId: number): Promise<TenantRef> {
    const tenant = await this.tenantService.findById(tenantId);
    return { schemaName: tenant.schemaName };
  }
}
