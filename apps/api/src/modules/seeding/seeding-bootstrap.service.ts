import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { SeedingService } from './seeding.service';

/**
 * Single owner of boot-time seeding. Replaces the three former
 * `onApplicationBootstrap` hooks. Skipped entirely for CLI runs
 * (`SEED_CLI=true`), which drive `SeedingService` directly.
 */
@Injectable()
export class SeedingBootstrapService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SeedingBootstrapService.name);

  constructor(private readonly seeding: SeedingService) {}

  async onApplicationBootstrap(): Promise<void> {
    if (process.env.SEED_CLI === 'true') return;

    const platform = await this.seeding.runPlatform({
      bypassEnvironmentGuard: true,
    });
    if (platform.failures.length > 0) {
      // Preserve fail-to-boot for the public platform seeders (e.g. a missing
      // bootstrap super admin must not let the API start unseeded).
      throw platform.failures[0].error;
    }

    const tenants = await this.seeding.runTenants({
      allActive: true,
      bypassEnvironmentGuard: true,
    });
    if (tenants.failures.length > 0) {
      this.logger.warn(
        `${tenants.failures.length} tenant seeder(s) failed during boot; continuing`,
      );
    }
  }
}
