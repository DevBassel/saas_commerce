import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Tenant } from './entities/tenant.entity';
import { TenantService } from './tenant.service';
import { TenantManagerService } from './tenant-manager.service';
import { TenantProvisionerService } from './tenant-provisioner.service';

@Module({
  imports: [TypeOrmModule.forFeature([Tenant])],
  providers: [TenantService, TenantManagerService, TenantProvisionerService],
  exports: [TenantService, TenantManagerService, TenantProvisionerService],
})
export class TenantModule {}
