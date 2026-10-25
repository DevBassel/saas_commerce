import { Controller, Get } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Public } from '../../modules/auth/decorators/isPublic.decorator';
import { Platform } from '../../modules/auth/decorators/isPlatform.decorator';
import { R2Service } from '../storage/r2.service';
import { SkipThrottle } from '@nestjs/throttler';
import { TenantCacheService } from '../cache/tenant-cache.service';

@Controller('health')
@Public()
@Platform()
@SkipThrottle()
export class HealthController {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly r2: R2Service,
    private readonly cache: TenantCacheService,
  ) {}

  @Get()
  async check() {
    const [db, r2, cache] = await Promise.all([
      this.pingDb(),
      this.r2.healthy(),
      this.cache.stats(),
    ]);
    return {
      status: db && r2 ? 'ok' : 'degraded',
      db,
      r2,
      cache,
    };
  }

  private async pingDb(): Promise<boolean> {
    try {
      await this.dataSource.query('SELECT 1');
      return true;
    } catch {
      return false;
    }
  }
}
