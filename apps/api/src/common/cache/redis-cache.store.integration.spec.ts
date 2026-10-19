import { randomUUID } from 'crypto';
import type { ICache } from '../config/env.interface';
import { RedisCacheStore } from './redis-cache.store';

const url = process.env.REDIS_URL;
const describeRedis = url ? describe : describe.skip;

const cacheOptions = (): ICache => ({
  enabled: true,
  maxEntryBytes: 262144,
  maxInflight: 100,
  operationTimeoutMs: 500,
  productsTtlSeconds: 30,
  categoriesTtlSeconds: 300,
  plansTtlSeconds: 300,
  redis: {
    url,
    tls: false,
    connectTimeoutMs: 1000,
    commandTimeoutMs: 500,
    safetyTtlSeconds: 600,
  },
});

const logger = { warn: jest.fn(), debug: jest.fn() };

describeRedis('RedisCacheStore (live Redis)', () => {
  let store: RedisCacheStore;
  const namespace = `itest:${randomUUID()}`;
  const key = (suffix: string) => `api:v1:cache:${namespace}:${suffix}`;

  beforeAll(() => {
    store = new RedisCacheStore(cacheOptions(), logger as never);
  });

  afterAll(async () => {
    await store.invalidateNamespace(namespace);
    await store.close();
  });

  it('reads and writes values', async () => {
    await store.set(key('one'), { id: 1 }, 5000, 8, namespace, 0);

    await expect(store.get(key('one'))).resolves.toMatchObject({
      value: { id: 1 },
    });
  });

  it('expires values by TTL', async () => {
    await store.set(key('short'), 'gone', 20, 6, namespace, 0);
    await new Promise((resolve) => setTimeout(resolve, 40));

    await expect(store.get(key('short'))).resolves.toBeNull();
  });

  it('rejects a write from a pre-invalidation version', async () => {
    const version = await store.getVersion(namespace);
    await store.set(key('guarded'), 'old', 5000, 5, namespace, version);

    await store.invalidateNamespace(namespace);

    await expect(
      store.set(key('guarded'), 'stale', 5000, 7, namespace, version),
    ).resolves.toBe(false);
    await expect(store.get(key('guarded'))).resolves.toBeNull();
    expect(await store.getVersion(namespace)).toBe(version + 1);
  });

  it('invalidates only the requested namespace', async () => {
    const other = `${namespace}:other`;
    await store.set(
      key('mine'),
      'a',
      5000,
      3,
      namespace,
      await store.getVersion(namespace),
    );
    await store.set(
      `api:v1:cache:${other}:key`,
      'b',
      5000,
      3,
      other,
      await store.getVersion(other),
    );

    await store.invalidateNamespace(namespace);

    await expect(store.get(key('mine'))).resolves.toBeNull();
    await expect(
      store.get(`api:v1:cache:${other}:key`),
    ).resolves.not.toBeNull();
    await store.invalidateNamespace(other);
  });
});
