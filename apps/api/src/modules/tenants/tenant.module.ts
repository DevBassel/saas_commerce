import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Tenant } from './entities/tenant.entity';
import { TenantService } from './tenant.service';
import { TenantManagerService } from './services/tenant-manager.service';
import { TenantProvisionerService } from './services/tenant-provisioner.service';
import { TenantResolutionService } from './services/tenant-resolution.service';
import { TenantReseedService } from './services/tenant-reseed.service';

@Module({
  imports: [TypeOrmModule.forFeature([Tenant])],
  providers: [
    TenantService,
    TenantManagerService,
    TenantProvisionerService,
    TenantResolutionService,
    TenantReseedService,
  ],
  exports: [
    TenantService,
    TenantManagerService,
    TenantProvisionerService,
    TenantResolutionService,
  ],
})
export class TenantModule {}
