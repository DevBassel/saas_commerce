import { Injectable } from '@nestjs/common';
import { TenantService } from '../../tenants/tenant.service';

export type TenantRef = { schemaName: string };

@Injectable()
export class PlatformTenantRefService {
  constructor(private readonly tenantService: TenantService) {}

  async resolve(tenantId: number): Promise<TenantRef> {
    const tenant = await this.tenantService.findById(tenantId);
    return { schemaName: tenant.schemaName };
  }
}
