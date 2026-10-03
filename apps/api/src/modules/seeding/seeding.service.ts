import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { IAPP, ISeeding, IENV } from 'src/common/config/env.interface';
import { TenantService } from 'src/modules/tenants/tenant.service';
import { TenantManagerService } from 'src/modules/tenants/services/tenant-manager.service';
import { Tenant } from 'src/modules/tenants/entities/tenant.entity';
import { TenantStatus } from 'src/modules/tenants/enums/tenantStatus.enum';
import { SeederRegistry } from './seeder-registry.service';
import { SeederContext } from './interfaces/seeder.interface';
import { TenantSeederContext } from './interfaces/tenant-seeder.interface';
import { SeederScope } from './constants/seeding.constants';

export interface SeederRunEntry {
  scope: SeederScope;
  seeder: string;
  tenant?: { slug: string; schemaName: string };
}

export interface SeederFailure {
  scope: SeederScope;
  seeder: string;
  tenant?: { slug: string; schemaName: string };
  error: unknown;
}

export interface SeedRunResult {
  ran: SeederRunEntry[];
  failures: SeederFailure[];
}

export interface RunPlatformOptions {
  names?: string[];
  force?: boolean;
  bypassEnvironmentGuard?: boolean;
}

export interface RunTenantsOptions {
  tenantIds?: number[];
  slugs?: string[];
  allActive?: boolean;
  names?: string[];
  force?: boolean;
  bypassEnvironmentGuard?: boolean;
}

interface EnvironmentScoped {
  environments?: readonly string[];
}

@Injectable()
export class SeedingService {
  private readonly logger = new Logger(SeedingService.name);

  constructor(
    private readonly registry: SeederRegistry,
    private readonly tenantService: TenantService,
    private readonly tenantManager: TenantManagerService,
    private readonly config: ConfigService<IENV>,
    @InjectDataSource() private readonly publicDataSource: DataSource,
  ) {}

  private get environment(): string {
    return this.config.getOrThrow<IAPP>('app').env;
  }

  assertEnvironmentAllowed(force: boolean): void {
    if (this.environment !== 'production') return;

    const { allowProduction } = this.config.getOrThrow<ISeeding>('seeding');
    if (allowProduction && force) return;

    throw new Error(
      'Refusing to seed in production: set SEED_ALLOW_PRODUCTION=true and pass --force.',
    );
  }

  async runPlatform(options: RunPlatformOptions = {}): Promise<SeedRunResult> {
    if (!options.bypassEnvironmentGuard) {
      this.assertEnvironmentAllowed(Boolean(options.force));
    }

    const seeders = this.registry.getPlatform(options.names);
    const environment = this.environment;
    const context: SeederContext = {
      dataSource: this.publicDataSource,
      environment,
    };
    const result: SeedRunResult = { ran: [], failures: [] };

    for (const seeder of seeders) {
      if (!this.appliesTo(seeder, environment)) {
        this.logger.log(
          `Skipping platform/${seeder.name} (environment ${environment})`,
        );
        continue;
      }

      try {
        await seeder.run(context);
        result.ran.push({ scope: SeederScope.PLATFORM, seeder: seeder.name });
      } catch (error) {
        this.logger.error(
          `[Seeder] platform/${seeder.name} failed: ${String(error)}`,
        );
        result.failures.push({
          scope: SeederScope.PLATFORM,
          seeder: seeder.name,
          error,
        });
        break;
      }
    }

    return result;
  }

  async runTenants(options: RunTenantsOptions = {}): Promise<SeedRunResult> {
    if (!options.bypassEnvironmentGuard) {
      this.assertEnvironmentAllowed(Boolean(options.force));
    }

    const seeders = this.registry.getTenant(options.names);
    const tenants = await this.resolveTenants(options);
    const environment = this.environment;
    const result: SeedRunResult = { ran: [], failures: [] };

    for (const tenant of tenants) {
      const tenantRef = { slug: tenant.slug, schemaName: tenant.schemaName };

      let dataSource: DataSource;
      try {
        dataSource = await this.tenantManager.getDataSource(tenant);
      } catch (error) {
        this.logger.error(
          `[Seeder] datasource for tenant ${tenant.slug} (${tenant.schemaName}) failed: ${String(error)}`,
        );
        result.failures.push({
          scope: SeederScope.TENANT,
          seeder: '<datasource>',
          tenant: tenantRef,
          error,
        });
        continue;
      }

      for (const seeder of seeders) {
        if (!this.appliesTo(seeder, environment)) {
          this.logger.log(
            `Skipping tenant/${seeder.name} for ${tenant.slug} (environment ${environment})`,
          );
          continue;
        }

        const context: TenantSeederContext = {
          dataSource,
          manager: dataSource.manager,
          environment,
          tenant,
          schemaName: tenant.schemaName,
        };

        try {
          await seeder.run(context);
          result.ran.push({
            scope: SeederScope.TENANT,
            seeder: seeder.name,
            tenant: tenantRef,
          });
        } catch (error) {
          this.logger.error(
            `[Seeder] tenant/${seeder.name} failed for ${tenant.slug} (${tenant.schemaName}): ${String(error)}`,
          );
          result.failures.push({
            scope: SeederScope.TENANT,
            seeder: seeder.name,
            tenant: tenantRef,
            error,
          });
          break;
        }
      }
    }

    return result;
  }

  async runAll(
    options: { names?: string[]; force?: boolean } = {},
  ): Promise<SeedRunResult> {
    const platform = await this.runPlatform(options);
    const tenants = await this.runTenants({ ...options, allActive: true });
    return {
      ran: [...platform.ran, ...tenants.ran],
      failures: [...platform.failures, ...tenants.failures],
    };
  }

  private async resolveTenants(options: RunTenantsOptions): Promise<Tenant[]> {
    const explicit: Tenant[] = [];

    for (const id of options.tenantIds ?? []) {
      explicit.push(await this.tenantService.findById(id));
    }
    for (const slug of options.slugs ?? []) {
      const tenant = await this.tenantService.findBySlug(slug);
      if (!tenant) throw new NotFoundException(`Tenant "${slug}" not found`);
      explicit.push(tenant);
    }

    if (explicit.length > 0) {
      const single = explicit.length === 1;
      for (const tenant of explicit) {
        if (tenant.status === TenantStatus.ACTIVE) continue;
        if (single && options.force) continue;
        throw new BadRequestException(
          `Tenant "${tenant.slug}" is inactive. Pass --force in development to seed it anyway.`,
        );
      }
      return explicit;
    }

    const all = await this.tenantService.findAll();
    return all.filter((tenant) => tenant.status === TenantStatus.ACTIVE);
  }

  private appliesTo(seeder: EnvironmentScoped, environment: string): boolean {
    return !seeder.environments || seeder.environments.includes(environment);
  }
}
