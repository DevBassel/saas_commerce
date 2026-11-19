import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Tenant } from './entities/tenant.entity';
import { TenantService } from './tenant.service';
import { TenantManagerService } from './services/tenant-manager.service';
import { TenantProvisionerService } from './services/tenant-provisioner.service';
import { TenantResolutionService } from './services/tenant-resolution.service';
import { TenantMigrationService } from './services/tenant-migration.service';

@Module({
  imports: [TypeOrmModule.forFeature([Tenant])],
  providers: [
    TenantService,
    TenantManagerService,
    TenantMigrationService,
    TenantProvisionerService,
    TenantResolutionService,
  ],
  exports: [
    TenantService,
    TenantManagerService,
    TenantMigrationService,
    TenantProvisionerService,
    TenantResolutionService,
  ],
})
export class TenantModule {}
