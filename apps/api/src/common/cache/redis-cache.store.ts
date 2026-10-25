import Redis from 'ioredis';
import type { RedisOptions } from 'ioredis';
import { PinoLogger } from 'nestjs-pino';
import type { ICache } from '../config/env.interface';
import type {
  CacheEntry,
  CacheStore,
  InvalidationHandler,
} from './cache.types';

const INVALIDATION_CHANNEL = 'cache:invalidate';

const WRITE_SCRIPT = `
local current = redis.call('GET', KEYS[1])
if not current then current = '0' end
if ARGV[3] ~= '' and current ~= ARGV[3] then return 0 end
redis.call('SADD', KEYS[2], KEYS[3])
redis.call('SET', KEYS[3], ARGV[1], 'PX', ARGV[2])
redis.call('PEXPIRE', KEYS[2], ARGV[4])
return 1
`;

const INVALIDATE_SCRIPT = `
local keys = redis.call('SMEMBERS', KEYS[1])
redis.call('INCR', KEYS[2])
redis.call('PEXPIRE', KEYS[2], ARGV[1])
for index = 1, #keys do
  redis.call('DEL', keys[index])
end
redis.call('DEL', KEYS[1])
return #keys
`;

/**
 * Redis-backed cache store.
 *
 * Keys are the full logical cache keys produced by `TenantCacheService`, so
 * they already carry the `api:v1:cache` prefix. Invalidation never uses `KEYS`
 * or `SCAN`: each namespace has a set index of its own keys.
 */
export class RedisCacheStore implements CacheStore {
  private readonly client: Redis;
  private subscriber?: Redis;
  private subscribed = false;
  private readonly safetyTtlMs: number;

  constructor(
    private readonly options: ICache,
    private readonly logger: PinoLogger,
    client?: Redis,
    subscriber?: Redis,
  ) {
    this.safetyTtlMs = Math.max(
      options.redis.safetyTtlSeconds * 1000,
      Math.max(
        options.productsTtlSeconds,
        options.categoriesTtlSeconds,
        options.plansTtlSeconds,
      ) *
        1000 +
        60_000,
    );

    this.client = client ?? this.createClient();
    this.subscriber = subscriber;
    this.client.on('error', (error: Error) => {
      this.logger.warn({ error: error.message }, 'cache.redis_error');
    });
  }

  async get<T>(key: string): Promise<CacheEntry<T> | null> {
    const raw = await this.client.get(key);
    if (raw === null) return null;

    try {
      return {
        value: JSON.parse(raw) as T,
        sizeBytes: Buffer.byteLength(raw, 'utf8'),
      };
    } catch {
      return null;
    }
  }

  async set<T>(
    key: string,
    value: T,
    ttlMs: number,
    sizeBytes: number,
    namespace: string,
    expectedVersion?: number,
  ): Promise<boolean> {
    if (sizeBytes > this.options.maxEntryBytes) return false;
    const payload = JSON.stringify(value);
    if (payload === undefined) return false;

    const result = await this.client.eval(
      WRITE_SCRIPT,
      3,
      this.versionKey(namespace),
      this.indexKey(namespace),
      key,
      payload,
      String(ttlMs),
      expectedVersion === undefined ? '' : String(expectedVersion),
      String(this.safetyTtlMs),
    );

    return Number(result) === 1;
  }

  async invalidateNamespace(namespace: string): Promise<number> {
    const removed = await this.client.eval(
      INVALIDATE_SCRIPT,
      2,
      this.indexKey(namespace),
      this.versionKey(namespace),
      String(this.safetyTtlMs),
    );

    await this.client.publish(
      INVALIDATION_CHANNEL,
      JSON.stringify({ namespace }),
    );

    return Number(removed) || 0;
  }

  getVersion(namespace: string): Promise<number> {
    return this.client.get(this.versionKey(namespace)).then((raw) => {
      if (!raw) return 0;
      const parsed = Number.parseInt(raw, 10);
      return Number.isFinite(parsed) ? parsed : 0;
    });
  }

  subscribeInvalidations(handler: InvalidationHandler): void {
    if (this.subscribed) return;

    const subscriber =
      this.subscriber ??
      this.createClient({
        enableOfflineQueue: true,
        maxRetriesPerRequest: null,
        retryStrategy: (times: number) => Math.min(times * 200, 5000),
      });
    this.subscriber = subscriber;
    this.subscribed = true;

    subscriber.on('error', (error: Error) => {
      this.logger.warn(
        { error: error.message },
        'cache.redis_subscriber_error',
      );
    });
    subscriber.on('message', (_channel: string, message: string) => {
      try {
        const parsed = JSON.parse(message) as { namespace?: unknown };
        if (typeof parsed.namespace === 'string') {
          handler(parsed.namespace);
        }
      } catch (error) {
        this.logger.warn(
          {
            error: error instanceof Error ? error.message : String(error),
          },
          'cache.invalidation_message_invalid',
        );
      }
    });

    // Do not block boot on a cold Redis. ioredis re-subscribes automatically
    // after a reconnect; until then the namespace version still protects writes.
    void subscriber.subscribe(INVALIDATION_CHANNEL).catch((error: unknown) => {
      this.logger.warn(
        { error: error instanceof Error ? error.message : String(error) },
        'cache.invalidation_subscribe_failed',
      );
    });
  }

  async close(): Promise<void> {
    const subscriber = this.subscriber;
    this.subscriber = undefined;
    await this.closeClient(subscriber);
    await this.closeClient(this.client);
  }

  private createClient(overrides: Partial<RedisOptions> = {}): Redis {
    const options: RedisOptions = {
      lazyConnect: false,
      enableOfflineQueue: false,
      maxRetriesPerRequest: 1,
      connectTimeout: this.options.redis.connectTimeoutMs,
      commandTimeout: this.options.redis.commandTimeoutMs,
      ...(this.options.redis.tls ? { tls: {} } : {}),
      ...overrides,
    };

    return new Redis(
      this.options.redis.url ?? 'redis://127.0.0.1:6379',
      options,
    );
  }

  private async closeClient(client: Redis | undefined): Promise<void> {
    if (!client) return;
    if (client.status === 'wait' || client.status === 'end') {
      client.disconnect();
      return;
    }
    try {
      await client.quit();
    } catch {
      client.disconnect();
    }
  }

  private versionKey(namespace: string): string {
    return `nsv:${namespace}`;
  }

  private indexKey(namespace: string): string {
    return `ns:${namespace}`;
  }

  async pingRedis(): Promise<boolean> {
    if (this.client.status !== 'ready') {
      await new Promise<void>((resolve, reject) => {
        const cleanup = () => {
          clearTimeout(timer);
          this.client.off('ready', onReady);
          this.client.off('error', onError);
        };
        const onReady = () => {
          cleanup();
          resolve();
        };
        const onError = (error: Error) => {
          cleanup();
          reject(error);
        };

        const timer = setTimeout(() => {
          cleanup();
          reject(
            new Error(
              `Redis was not ready after ${this.options.redis.connectTimeoutMs}ms`,
            ),
          );
        }, this.options.redis.connectTimeoutMs);

        this.client.once('ready', onReady);
        this.client.once('error', onError);

        // Close the gap between the initial status check and listener setup.
        if (this.client.status === 'ready') onReady();
      });
    }
    return (await this.client.ping()) === 'PONG';
  }
}
