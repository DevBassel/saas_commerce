import { Controller, Get } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Public } from '../../modules/auth/decorators/isPublic.decorator';
import { Platform } from '../../modules/auth/decorators/isPlatform.decorator';
import { R2Service } from '../storage/r2.service';

@Controller('health')
@Public()
@Platform()
export class HealthController {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly r2: R2Service,
  ) {}

  @Get()
  async check(): Promise<{ status: string; db: boolean; r2: boolean }> {
    const [db, r2] = await Promise.all([this.pingDb(), this.r2.healthy()]);
    return { status: db && r2 ? 'ok' : 'degraded', db, r2 };
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
