import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource, EntityTarget, ObjectLiteral, Repository } from 'typeorm';
import { buildDataSourceOptions } from 'src/common/config/data-source.factory';
import { IDB, IENV, IAPP } from 'src/common/config/env.interface';
import { TENANT_ENTITIES } from '../tenant-entities';
import { TenantRef } from '../tenant.utils';

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
        await this.evictIfNeeded();
        this.cache.set(key, ds);
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
    const { tenantPoolSize, synchronize, syncTenants } =
      this.config.getOrThrow<IDB>('db');
    const { env } = this.config.getOrThrow<IAPP>('app');
    const options = buildDataSourceOptions(this.config, {
      schema: tenant.schemaName,
      entities: TENANT_ENTITIES,
      synchronize: synchronize && (env !== 'production' || syncTenants),
      poolSize: tenantPoolSize,
    });
    return new DataSource(options);
  }

  private async evictIfNeeded(): Promise<void> {
    if (this.cache.size < TENANT_CACHE_CAP) return;

    const [oldestKey, oldest] = this.cache.entries().next().value as [
      string,
      DataSource,
    ];

    this.cache.delete(oldestKey);

    if (oldest.isInitialized) await oldest.destroy();

    this.logger.log(`Evicted tenant datasource ${oldestKey}`);
  }
}
