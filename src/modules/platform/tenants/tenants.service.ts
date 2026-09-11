import { Injectable } from '@nestjs/common';
import { TenantService } from '../../tenants/tenant.service';

@Injectable()
export class PlatformTenantsService {
  constructor(private readonly tenantService: TenantService) {}

  listTenants() {
    return this.tenantService.findAll();
  }

  getTenant(id: number) {
    return this.tenantService.findByIdWithOwner(id);
  }
}
