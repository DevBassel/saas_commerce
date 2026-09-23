import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource, EntityTarget, ObjectLiteral, Repository } from 'typeorm';
import { buildDataSourceOptions } from 'src/common/config/data-source.factory';
import { IDB, IENV } from 'src/common/config/env.interface';
import { Tenant } from '../entities/tenant.entity';
import { TENANT_ENTITIES } from '../tenant-entities';

type TenantRef = Pick<Tenant, 'schemaName'>;

const TENANT_CACHE_CAP = 100;

@Injectable()
export class TenantManagerService implements OnModuleDestroy {
  private readonly logger = new Logger(TenantManagerService.name);
  private readonly cache = new Map<string, DataSource>();
  private readonly pending = new Map<string, Promise<DataSource>>();

  constructor(private readonly config: ConfigService<IENV>) {}

  async getDataSource(tenant: TenantRef): Promise<DataSource> {
    const key = tenant.schemaName;

    const cached = this.cache.get(key);
    if (cached) {
      this.cache.delete(key);
      this.cache.set(key, cached);
      return cached;
    }

    const inflight = this.pending.get(key);
    if (inflight) return inflight;

    const promise = this.createDataSource(tenant)
      .initialize()
      .then(async (ds) => {
        this.cache.set(key, ds);
        await this.evictIfNeeded();
        return ds;
      })
      .finally(() => {
        this.pending.delete(key);
      });

    this.pending.set(key, promise);
    return promise;
  }

  async getRepository<T extends ObjectLiteral>(
    entity: EntityTarget<T>,
    tenant: TenantRef,
  ): Promise<Repository<T>> {
    const ds = await this.getDataSource(tenant);
    return ds.getRepository(entity);
  }

  async release(tenant: TenantRef): Promise<void> {
    const key = tenant.schemaName;
    const ds = this.cache.get(key);
    if (!ds) return;
    this.cache.delete(key);
    if (ds.isInitialized) await ds.destroy();
    this.logger.log(`Released tenant datasource ${key}`);
  }

  async onModuleDestroy(): Promise<void> {
    for (const ds of this.cache.values()) {
      if (ds.isInitialized) await ds.destroy();
    }
    this.cache.clear();
  }

  private createDataSource(tenant: TenantRef): DataSource {
    const { tenantPoolSize } = this.config.getOrThrow<IDB>('db');
    const options = buildDataSourceOptions(this.config, {
      schema: tenant.schemaName,
      entities: TENANT_ENTITIES,
      synchronize: true,
      poolSize: tenantPoolSize,
    });
    return new DataSource(options);
  }

  private async evictIfNeeded(): Promise<void> {
    while (this.cache.size > TENANT_CACHE_CAP) {
      const oldestKey = this.cache.keys().next().value as string | undefined;
      if (oldestKey === undefined) break;
      const oldest = this.cache.get(oldestKey);
      this.cache.delete(oldestKey);
      if (oldest?.isInitialized) await oldest.destroy();
      this.logger.log(`Evicted tenant datasource ${oldestKey}`);
    }
  }
}
