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
import type { CacheEntry, CacheResolveResult, CacheStore } from './cache.types';

interface InFlightRecord {
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

// Bump when the canonical representation changes so old ambiguous fingerprints
// are never reused for new requests.
const CANONICAL_VERSION = 'v3:';

function stableStringify(value: unknown): string {
  if (value === undefined) return 'undefined';
  if (value === null) return 'null';
  if (Array.isArray(value)) {
    // Sort array elements for consistent fingerprinting
    const sorted = value.map(stableStringify).sort();
    return `[${sorted.join(',')}]`;
  }
  if (typeof value === 'object') {
    const keys = Object.keys(value).sort();
    return `{${keys
      .map(
        (k) =>
          `${stableStringify(k)}:${stableStringify((value as Record<string, unknown>)[k])}`,
      )
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

@Injectable()
export class TenantCacheService implements OnModuleInit, OnModuleDestroy {
  private readonly inflight = new Map<string, InFlightRecord>();

  constructor(
    @Inject(CACHE_STORE) private readonly store: CacheStore,
    private readonly config: ConfigService<IENV>,
    private readonly logger: PinoLogger,
  ) {}

  get enabled(): boolean {
    return this.config.getOrThrow<IENV['cache']>('cache').enabled;
  }

  onModuleInit(): void {
    if (!this.store.subscribeInvalidations) return;
    try {
      this.store.subscribeInvalidations((namespace) =>
        this.invalidateLocalFlights(namespace),
      );
    } catch (error) {
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
    const canonical =
      CANONICAL_VERSION +
      stableStringify({
        method: input.method.toUpperCase(),
        route: input.route,
        params: input.params ?? {},
        query: input.query ?? {},
      });
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
      this.logger.warn(
        { error: this.errorMessage(error), namespace, key: this.hashKey(key) },
        'cache.store_read_failed',
      );
    }

    if (entry) {
      return {
        value: entry.value,
        status: 'hit',
        namespace,
        ttlMs,
        sizeBytes: entry.sizeBytes,
      };
    }

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
      this.logger.warn(
        { error: this.errorMessage(error), namespace },
        'cache.invalidation_failed',
      );
    }

    // Mark every matching flight stale and remove it from the map so new
    // requests start a fresh flight instead of joining a pre-invalidation one.
    this.invalidateLocalFlights(namespace);
  }

  /**
   * Marks local in-flight loads stale without touching the store. Used by the
   * Redis invalidation subscription so every replica drops pre-invalidation
   * flights, including replicas that did not run the mutation.
   */
  private invalidateLocalFlights(namespace: string): void {
    for (const [key, record] of this.inflight) {
      if (record.namespace !== namespace) continue;
      record.invalidated = true;
      this.inflight.delete(key);
    }
  }

  async stats(): Promise<{
    enabled: boolean;
    driver: 'redis';
    connected: boolean;
  }> {
    try {
      return {
        enabled: this.enabled,
        driver: 'redis',
        connected: await this.store.pingRedis(),
      };
    } catch {
      return {
        enabled: this.enabled,
        driver: 'redis',
        connected: false,
      };
    }
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
      this.logger.warn(
        { namespace, key: this.hashKey(key) },
        'cache.inflight_saturated',
      );
      return { value: await loader(), bypassed: true };
    }

    const record: InFlightRecord = {
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
        this.cleanupFlight(key, record);
        throw error;
      }

      const current = this.inflight.get(key);
      const stale = record.invalidated || current !== record;
      this.cleanupFlight(key, record);

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

  private cleanupFlight(key: string, record: InFlightRecord): void {
    if (this.inflight.get(key) === record) {
      this.inflight.delete(key);
    }
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
