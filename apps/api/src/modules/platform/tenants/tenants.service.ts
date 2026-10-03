import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TenantService } from '../../tenants/tenant.service';
import { IENV } from '../../../common/config/env.interface';

export interface TenantStorage {
  usedKb: number;
  capacityKb: number;
}

@Injectable()
export class PlatformTenantsService {
  private readonly logger = new Logger(PlatformTenantsService.name);

  constructor(
    private readonly tenantService: TenantService,
    private readonly config: ConfigService<IENV>,
  ) {}

  private async getSchemaSizesSafe(
    schemas: string[],
  ): Promise<Map<string, number>> {
    try {
      return await this.tenantService.getSchemaSizes(schemas);
    } catch (error) {
      this.logger.warn(
        `Schema sizes unavailable: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );
      return new Map();
    }
  }

  async listTenants() {
    const tenants = await this.tenantService.findAll();
    const sizes = await this.getSchemaSizesSafe(
      tenants.map((tenant) => tenant.schemaName),
    );
    const schemaCapacityBytes = this.tenantService.getSchemaCapacityBytes();
    return tenants.map((tenant) => ({
      ...tenant,
      schemaSizeBytes: sizes.get(tenant.schemaName) ?? 0,
      schemaCapacityBytes,
    }));
  }

  async getTenant(id: number) {
    const { owner, ...tenant } = await this.tenantService.findByIdWithOwner(id);
    const sizes = await this.getSchemaSizesSafe([tenant.schemaName]);
    const schemaCapacityBytes = this.tenantService.getSchemaCapacityBytes();
    return {
      ...tenant,
      owner,
      schemaSizeBytes: sizes.get(tenant.schemaName) ?? 0,
      schemaCapacityBytes,
    };
  }

  async toggleActiveTenant(id: number) {
    return this.tenantService.toggleActiveTenant(id);
  }
}
