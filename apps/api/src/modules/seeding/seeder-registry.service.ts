import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { PlatformSeeder } from './interfaces/seeder.interface';
import { TenantSeeder } from './interfaces/tenant-seeder.interface';
import {
  PLATFORM_SEEDERS,
  TENANT_SEEDERS,
} from './constants/seeding.constants';

interface NamedSeeder {
  readonly name: string;
  readonly order: number;
}

const sortSeeders = <T extends NamedSeeder>(seeders: T[]): T[] =>
  [...seeders].sort(
    (a, b) => a.order - b.order || a.name.localeCompare(b.name),
  );

const validateSeeders = <T extends NamedSeeder>(
  scope: string,
  seeders: T[],
): T[] => {
  const seen = new Set<string>();
  for (const seeder of seeders) {
    if (!seeder.name) {
      throw new Error(`[Seeding] ${scope} seeder is missing a name`);
    }
    if (seen.has(seeder.name)) {
      throw new Error(
        `[Seeding] Duplicate ${scope} seeder name "${seeder.name}"`,
      );
    }
    seen.add(seeder.name);
  }
  return sortSeeders(seeders);
};

const pick = <T extends NamedSeeder>(
  scope: string,
  seeders: T[],
  names?: string[],
): T[] => {
  if (!names || names.length === 0) {
    return seeders.filter((seeder) => !(seeder as { optIn?: boolean }).optIn);
  }

  const requested = [...new Set(names)];
  const byName = new Map(seeders.map((seeder) => [seeder.name, seeder]));
  const unknown = requested.filter((name) => !byName.has(name));
  if (unknown.length > 0) {
    throw new Error(
      `[Seeding] Unknown ${scope} seeder(s): ${unknown.join(', ')}. Valid: ${seeders
        .map((seeder) => seeder.name)
        .join(', ')}`,
    );
  }

  return seeders.filter((seeder) => requested.includes(seeder.name));
};

@Injectable()
export class SeederRegistry implements OnModuleInit {
  private platform: PlatformSeeder[] = [];
  private tenant: TenantSeeder[] = [];

  constructor(
    @Inject(PLATFORM_SEEDERS)
    private readonly injectedPlatform: PlatformSeeder[],
    @Inject(TENANT_SEEDERS)
    private readonly injectedTenant: TenantSeeder[],
  ) {}

  onModuleInit(): void {
    this.platform = validateSeeders('platform', this.injectedPlatform ?? []);
    this.tenant = validateSeeders('tenant', this.injectedTenant ?? []);
  }

  getPlatform(names?: string[]): PlatformSeeder[] {
    return pick('platform', this.platform, names);
  }

  getTenant(names?: string[]): TenantSeeder[] {
    return pick('tenant', this.tenant, names);
  }

  hasPlatform(name: string): boolean {
    return this.platform.some((seeder) => seeder.name === name);
  }

  hasTenant(name: string): boolean {
    return this.tenant.some((seeder) => seeder.name === name);
  }

  get platformNames(): string[] {
    return this.platform.map((seeder) => seeder.name);
  }

  get tenantNames(): string[] {
    return this.tenant.map((seeder) => seeder.name);
  }
}
