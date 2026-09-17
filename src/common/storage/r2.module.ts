import { Global, Module } from '@nestjs/common';
import { R2Service } from './r2.service';
import { R2HealthController } from './r2.health.controller';

@Global()
@Module({
  providers: [R2Service],
  controllers: [R2HealthController],
  exports: [R2Service],
})
export class R2Module {}
