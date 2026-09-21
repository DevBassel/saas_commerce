import { Controller, Get } from '@nestjs/common';
import { Public } from '../../modules/auth/decorators/isPublic.decorator';
import { Platform } from '../../modules/auth/decorators/isPlatform.decorator';
import { R2Service } from './r2.service';

@Controller('health/storage')
@Public()
@Platform()
export class R2HealthController {
  constructor(private readonly r2: R2Service) {}

  @Get()
  async check(): Promise<{ ok: boolean }> {
    return { ok: await this.r2.healthy() };
  }
}
