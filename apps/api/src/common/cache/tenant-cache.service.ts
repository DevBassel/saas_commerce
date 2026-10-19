import {
  Inject,
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import { PinoLogger } from 'nestjs-pino';
import type { IENV } from '../config/env.interface';
import { TenantRef } from '../../modules/tenants/utils/tenant.utils';
import {
  CachePolicyName,
  CacheScope,
  CACHE_POLICIES,
  resolveCacheTtlMs,
} from './cache-policy';
import { CACHE_STORE } from './cache.types';
import type {
  CacheEntry,
  CacheResolveResult,
  CacheStats,
  CacheStore,
  CacheStoreStats,
} from './cache.types';

interface InFlightRecord {
  token: number;
  namespace: string;
  invalidated: boolean;
  promise: Promise<unknown>;
}

interface CanonicalInput {
  method: string;
  route: string;
  params?: Record<string, unknown>;
  query?: Record<string, unknown>;
}

const MAX_CANONICAL_BYTES = 8 * 1024;

const canonicalValue = (value: unknown): string => {
  if (Array.isArray(value)) {
    const values = value.map(canonicalValue).sort();
    return `[${values.join(',')}]`;
  }
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record).sort();
    return `{${keys
      .map((key) => `${key}:${canonicalValue(record[key])}`)
      .join(',')}}`;
  }
  return String(value);
};

const canonicalRecord = (record: Record<string, unknown> = {}): string =>
  Object.keys(record)
    .sort()
    .map((key) => `${key}=${canonicalValue(record[key])}`)
    .join('&');

@Injectable()
export class TenantCacheService implements OnModuleInit, OnModuleDestroy {
  private readonly inflight = new Map<string, InFlightRecord>();
  private tokenSequence = 0;
  private hits = 0;
  private misses = 0;
  private bypasses = 0;
  private errors = 0;
  private invalidations = 0;

  constructor(
    @Inject(CACHE_STORE) private readonly store: CacheStore,
    private readonly config: ConfigService<IENV>,
    private readonly logger: PinoLogger,
  ) {}

  get enabled(): boolean {
    return this.config.getOrThrow<IENV['cache']>('cache').enabled;
  }

  get driver(): 'redis' {
    return 'redis';
  }

  async onModuleInit(): Promise<void> {
    if (!this.store.subscribeInvalidations) return;
    try {
      await this.store.subscribeInvalidations((namespace) =>
        this.invalidateLocalFlights(namespace),
      );
    } catch (error) {
      this.errors += 1;
      this.logger.warn(
        { error: this.errorMessage(error) },
        'cache.invalidation_subscribe_failed',
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    try {
      await this.store.close?.();
    } catch (error) {
      this.logger.warn(
        { error: this.errorMessage(error) },
        'cache.store_close_failed',
      );
    }
  }

  fingerprint(input: CanonicalInput): string | null {
    const canonical = [
      input.method.toUpperCase(),
      input.route,
      canonicalRecord(input.params),
      canonicalRecord(input.query),
    ].join('\n');
    if (Buffer.byteLength(canonical, 'utf8') > MAX_CANONICAL_BYTES) {
      return null;
    }
    return createHash('sha256').update(canonical).digest('hex');
  }

  namespaceFor(
    scope: CacheScope,
    schemaName: string | undefined,
    policy: CachePolicyName,
  ): string | null {
    const definition = CACHE_POLICIES[policy];
    if (scope === 'tenant') {
      if (!schemaName) return null;
      return `tenant:${schemaName}:${definition.namespace}`;
    }
    return `platform:${definition.namespace}`;
  }

  keyFor(
    scope: CacheScope,
    schemaName: string | undefined,
    policy: CachePolicyName,
    fingerprint: string,
  ): string | null {
    const namespace = this.namespaceFor(scope, schemaName, policy);
    if (!namespace) return null;
    const app = this.config.getOrThrow<IENV['app']>('app');
    return `${app.apiPrefix}:${app.apiVersion}:cache:${namespace}:${fingerprint}`;
  }

  async resolve<T>(
    scope: CacheScope,
    schemaName: string | undefined,
    policy: CachePolicyName,
    fingerprint: string | null,
    loader: () => Promise<T>,
  ): Promise<CacheResolveResult<T>> {
    const cache = this.config.getOrThrow<IENV['cache']>('cache');
    const key = fingerprint
      ? this.keyFor(scope, schemaName, policy, fingerprint)
      : null;
    const namespace = this.namespaceFor(scope, schemaName, policy);
    const ttlMs = resolveCacheTtlMs(policy, cache);

    if (!cache.enabled || !key || !namespace) {
      this.bypasses += 1;
      const value = await loader();
      return {
        value,
        status: 'bypass',
        namespace,
        ttlMs,
        sizeBytes: this.measure(value),
      };
    }

    let entry: CacheEntry<T> | null = null;
    try {
      entry = await this.withTimeout(this.store.get<T>(key), 'get');
    } catch (error) {
      this.errors += 1;
      this.logger.warn(
        { error: this.errorMessage(error), namespace, key: this.hashKey(key) },
        'cache.store_read_failed',
      );
    }

    if (entry) {
      this.hits += 1;
      return {
        value: entry.value,
        status: 'hit',
        namespace,
        ttlMs,
        sizeBytes: entry.sizeBytes,
      };
    }

    this.misses += 1;
    const flight = await this.runFlight(
      key,
      namespace,
      ttlMs,
      loader,
      true,
      cache.maxInflight,
    );
    return {
      value: flight.value,
      status: flight.bypassed ? 'bypass' : 'miss',
      namespace,
      ttlMs,
      sizeBytes: this.measure(flight.value),
    };
  }

  async invalidateProducts(tenant: TenantRef): Promise<void> {
    await this.invalidateNamespace(
      this.namespaceFor('tenant', tenant.schemaName, 'products')!,
    );
  }

  async invalidateCategories(tenant: TenantRef): Promise<void> {
    await this.invalidateNamespace(
      this.namespaceFor('tenant', tenant.schemaName, 'categories')!,
    );
  }

  async invalidatePlans(): Promise<void> {
    await this.invalidateNamespace(
      this.namespaceFor('platform', undefined, 'plans')!,
    );
  }

  async invalidateNamespace(namespace: string): Promise<void> {
    try {
      await this.withTimeout(
        this.store.invalidateNamespace(namespace),
        'invalidate',
      );
    } catch (error) {
      this.errors += 1;
      this.logger.warn(
        { error: this.errorMessage(error), namespace },
        'cache.invalidation_failed',
      );
    }

    // Mark every matching flight stale and remove it from the map so new
    // requests start a fresh flight instead of joining a pre-invalidation one.
    this.invalidateLocalFlights(namespace);
    this.invalidations += 1;
  }

  /**
   * Marks local in-flight loads stale without touching the store. Used by the
   * Redis invalidation subscription so every replica drops pre-invalidation
   * flights, including replicas that did not run the mutation.
   */
  invalidateLocalFlights(namespace: string): void {
    for (const [key, record] of this.inflight) {
      if (record.namespace !== namespace) continue;
      record.invalidated = true;
      this.inflight.delete(key);
    }
  }

  recordBypass(): void {
    this.bypasses += 1;
  }

  async stats(): Promise<CacheStats> {
    let storeStats: CacheStoreStats = {
      entries: 0,
      bytes: 0,
      evictions: 0,
    };
    try {
      storeStats = await this.withTimeout(this.store.stats(), 'stats');
    } catch (error) {
      this.errors += 1;
      this.logger.warn(
        { error: this.errorMessage(error) },
        'cache.store_stats_failed',
      );
    }
    return {
      enabled: this.enabled,
      driver: this.driver,
      hits: this.hits,
      misses: this.misses,
      bypasses: this.bypasses,
      errors: this.errors,
      invalidations: this.invalidations,
      entries: storeStats.entries,
      bytes: storeStats.bytes,
      evictions: storeStats.evictions,
      inflight: this.inflight.size,
    };
  }

  hashTenant(schemaName: string | undefined): string {
    if (!schemaName) return 'none';
    return createHash('sha256').update(schemaName).digest('hex').slice(0, 12);
  }

  private async runFlight<T>(
    key: string,
    namespace: string,
    ttlMs: number,
    loader: () => Promise<T>,
    allowRetry: boolean,
    maxInflight: number,
  ): Promise<{ value: T; bypassed: boolean }> {
    const existing = this.inflight.get(key);
    if (existing && !existing.invalidated) {
      return existing.promise as Promise<{ value: T; bypassed: boolean }>;
    }

    if (!existing && this.inflight.size >= maxInflight) {
      this.bypasses += 1;
      this.logger.warn(
        { namespace, key: this.hashKey(key) },
        'cache.inflight_saturated',
      );
      return { value: await loader(), bypassed: true };
    }

    const token = ++this.tokenSequence;
    const record: InFlightRecord = {
      token,
      namespace,
      invalidated: false,
      promise: Promise.resolve(),
    };
    this.inflight.set(key, record);

    record.promise = (async (): Promise<{
      value: T;
      bypassed: boolean;
    }> => {
      let expectedVersion: number | undefined;
      try {
        expectedVersion = await this.withTimeout(
          this.store.getVersion(namespace),
          'version',
        );
      } catch (error) {
        this.errors += 1;
        this.logger.warn(
          {
            error: this.errorMessage(error),
            namespace,
            key: this.hashKey(key),
          },
          'cache.store_version_failed',
        );
      }

      let value: T;
      try {
        value = await loader();
      } catch (error) {
        if (this.inflight.get(key) === record) this.inflight.delete(key);
        throw error;
      }

      const current = this.inflight.get(key);
      const stale = record.invalidated || current !== record;
      if (current === record) this.inflight.delete(key);

      if (stale) {
        // The result was invalidated while loading: never write it and retry
        // once with a fresh identity. If that is invalidated too, return the
        // value without caching.
        if (!allowRetry) return { value, bypassed: false };
        return this.runFlight(
          key,
          namespace,
          ttlMs,
          loader,
          false,
          maxInflight,
        );
      }

      const sizeBytes = this.measure(value);
      if (
        sizeBytes > this.config.getOrThrow<IENV['cache']>('cache').maxEntryBytes
      ) {
        // Oversized values are simply not cached; this is not an invalidation
        // and must not trigger the retry path.
        return { value, bypassed: false };
      }

      try {
        const written = await this.withTimeout(
          this.store.set(
            key,
            value,
            ttlMs,
            sizeBytes,
            namespace,
            expectedVersion,
          ),
          'set',
        );
        if (!written) {
          // Another replica invalidated this namespace while the loader ran.
          // The version guard refused the write; retry once with a fresh view.
          this.logger.warn(
            { namespace, key: this.hashKey(key) },
            'cache.write_rejected_stale',
          );
          if (allowRetry) {
            return this.runFlight(
              key,
              namespace,
              ttlMs,
              loader,
              false,
              maxInflight,
            );
          }
        }
      } catch (error) {
        this.errors += 1;
        this.logger.warn(
          {
            error: this.errorMessage(error),
            namespace,
            key: this.hashKey(key),
          },
          'cache.store_write_failed',
        );
      }
      return { value, bypassed: false };
    })();

    return record.promise as Promise<{ value: T; bypassed: boolean }>;
  }

  private measure(value: unknown): number {
    try {
      return Buffer.byteLength(JSON.stringify(value) ?? '', 'utf8');
    } catch {
      return 0;
    }
  }

  private hashKey(key: string): string {
    return createHash('sha256').update(key).digest('hex').slice(0, 12);
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }

  private withTimeout<T>(promise: Promise<T>, operation: string): Promise<T> {
    const timeoutMs =
      this.config.getOrThrow<IENV['cache']>('cache').operationTimeoutMs;
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`cache ${operation} timed out after ${timeoutMs}ms`));
      }, timeoutMs);
      promise.then(
        (value) => {
          clearTimeout(timer);
          resolve(value);
        },
        (error) => {
          clearTimeout(timer);
          reject(error instanceof Error ? error : new Error(String(error)));
        },
      );
    });
  }
}
