import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TenantService } from '../../tenants/tenant.service';
import { IENV } from '../../../common/config/env.interface';

export interface TenantStorage {
  usedKb: number;
  capacityKb: number;
}

@Injectable()
export class PlatformTenantsService {
  constructor(
    private readonly tenantService: TenantService,
    private readonly config: ConfigService<IENV>,
  ) {}

  async listTenants() {
    return await this.tenantService.findAll();
  }

  async getTenant(id: number) {
    const { owner, ...tenant } = await this.tenantService.findByIdWithOwner(id);
    return {
      ...tenant,
      owner,
    };
  }

  async toggleActiveTenant(id: number) {
    return this.tenantService.toggleActiveTenant(id);
  }
}
