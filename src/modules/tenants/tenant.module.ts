import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Tenant } from './entities/tenant.entity';
import { TenantService } from './tenant.service';
import { TenantManagerService } from './tenant-manager.service';
import { TenantProvisionerService } from './tenant-provisioner.service';
import { TenantResolutionService } from './tenant-resolution.service';
import { TenantReseedService } from './tenant-reseed.service';

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
