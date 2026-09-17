import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TenantService } from '../../tenants/tenant.service';
import { Tenant } from '../../tenants/entities/tenant.entity';
import { IDB, IENV } from '../../../common/config/env.interface';

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

  private buildStorage(
    tenant: Pick<Tenant, 'storageCapacityBytes'>,
    usedBytes = 0,
  ): TenantStorage {
    const { tenantStorageCapacityBytes } = this.config.getOrThrow<IDB>('db');
    const capacityBytes =
      tenant.storageCapacityBytes ?? tenantStorageCapacityBytes;
    const toKb = (bytes: number): number => Math.round(bytes / 1024);
    return {
      usedKb: toKb(usedBytes),
      capacityKb: toKb(capacityBytes),
    };
  }

  async listTenants() {
    const tenants = await this.tenantService.findAll();
    const sizes = await this.tenantService.getSchemaSizes(
      tenants.map((tenant) => tenant.schemaName),
    );
    return tenants.map((tenant) => ({
      ...tenant,
      storage: this.buildStorage(tenant, sizes.get(tenant.schemaName) ?? 0),
    }));
  }

  async getTenant(id: number) {
    const { owner, ...tenant } = await this.tenantService.findByIdWithOwner(id);
    const sizes = await this.tenantService.getSchemaSizes([tenant.schemaName]);
    return {
      ...tenant,
      owner,
      storage: this.buildStorage(tenant, sizes.get(tenant.schemaName) ?? 0),
    };
  }

  async toggleActiveTenant(id: number) {
    return this.tenantService.toggleActiveTenant(id);
  }
}
