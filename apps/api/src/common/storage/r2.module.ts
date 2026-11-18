import { Global, Module } from '@nestjs/common';
import { R2Service } from './r2.service';
import { R2HealthController } from './r2.health.controller';
import { TenantModule } from 'src/modules/tenants/tenant.module';
import { R2ImageOptimizerService } from './image-optimizer.service';

@Global()
@Module({
  providers: [R2Service, TenantModule, R2ImageOptimizerService],
  controllers: [R2HealthController],
  exports: [R2Service],
})
export class R2Module {}
