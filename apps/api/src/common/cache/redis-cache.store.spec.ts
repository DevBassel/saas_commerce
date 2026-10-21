import type Redis from 'ioredis';
import type { ICache } from '../config/env.interface';
import { RedisCacheStore } from './redis-cache.store';

const CACHE: ICache = {
  enabled: true,
  maxEntryBytes: 1024,
  maxInflight: 100,
  operationTimeoutMs: 50,
  productsTtlSeconds: 30,
  categoriesTtlSeconds: 300,
  plansTtlSeconds: 300,
  redis: {
    url: 'redis://cache:6379',
    tls: false,
    connectTimeoutMs: 1000,
    commandTimeoutMs: 50,
    safetyTtlSeconds: 600,
  },
};

const logger = { warn: jest.fn() };

const fakeClient = () => {
  const handlers: Record<string, (...args: unknown[]) => void> = {};
  return {
    on: jest.fn((event: string, handler: (...args: unknown[]) => void) => {
      handlers[event] = handler;
    }),
    get: jest.fn(),
    eval: jest.fn(),
    del: jest.fn(),
    publish: jest.fn(),
    subscribe: jest.fn().mockResolvedValue(1),
    quit: jest.fn().mockResolvedValue('OK'),
    disconnect: jest.fn(),
    emit: (event: string, ...args: unknown[]) => handlers[event]?.(...args),
  };
};

const build = () => {
  const client = fakeClient();
  const subscriber = fakeClient();
  const store = new RedisCacheStore(
    CACHE,
    logger as never,
    client as unknown as Redis,
    subscriber as unknown as Redis,
  );
  return { store, client, subscriber };
};

describe('RedisCacheStore', () => {
  beforeEach(() => jest.clearAllMocks());

  it('reads and JSON-parses a value', async () => {
    const { store, client } = build();
    client.get.mockResolvedValue('{"id":1,"name":"Shirt"}');

    await expect(store.get('api:v1:cache:k')).resolves.toMatchObject({
      value: { id: 1, name: 'Shirt' },
      sizeBytes: 23,
    });
  });

  it('returns null for a missing or malformed value', async () => {
    const { store, client } = build();
    client.get.mockResolvedValueOnce(null).mockResolvedValueOnce('not-json');

    await expect(store.get('k')).resolves.toBeNull();
    await expect(store.get('k')).resolves.toBeNull();
  });

  it('writes through Lua with the namespace version and index', async () => {
    const { store, client } = build();
    client.eval.mockResolvedValue(1);

    await expect(
      store.set(
        'api:v1:cache:tenant:tenant_a:products:fp',
        { id: 1 },
        30_000,
        8,
        'tenant:tenant_a:products',
        0,
      ),
    ).resolves.toBe(true);

    expect(client.eval).toHaveBeenCalledWith(
      expect.stringContaining('SADD'),
      3,
      'nsv:tenant:tenant_a:products',
      'ns:tenant:tenant_a:products',
      'api:v1:cache:tenant:tenant_a:products:fp',
      '{"id":1}',
      '30000',
      '0',
      '600000',
    );
  });

  it('reports a rejected write when the namespace version changed', async () => {
    const { store, client } = build();
    client.eval.mockResolvedValue(0);

    await expect(store.set('k', { id: 1 }, 1000, 8, 'ns', 2)).resolves.toBe(
      false,
    );
  });

  it('skips the version guard when no expected version is supplied', async () => {
    const { store, client } = build();
    client.eval.mockResolvedValue(1);

    await store.set('k', { id: 1 }, 1000, 8, 'ns');

    expect(client.eval).toHaveBeenCalledWith(
      expect.any(String),
      3,
      'nsv:ns',
      'ns:ns',
      'k',
      '{"id":1}',
      '1000',
      '',
      '600000',
    );
  });

  it('refuses values above the per-entry byte cap without calling Redis', async () => {
    const { store, client } = build();

    await expect(store.set('k', 'x', 1000, 2048, 'ns')).resolves.toBe(false);
    expect(client.eval).not.toHaveBeenCalled();
  });

  it('invalidates a namespace and publishes the namespace', async () => {
    const { store, client } = build();
    client.eval.mockResolvedValue(3);

    await expect(
      store.invalidateNamespace('tenant:tenant_a:products'),
    ).resolves.toBe(3);

    expect(client.eval).toHaveBeenCalledWith(
      expect.stringContaining('SMEMBERS'),
      2,
      'ns:tenant:tenant_a:products',
      'nsv:tenant:tenant_a:products',
      '600000',
    );
    expect(client.publish).toHaveBeenCalledWith(
      'cache:invalidate',
      JSON.stringify({ namespace: 'tenant:tenant_a:products' }),
    );
  });

  it('reads namespace versions', async () => {
    const { store, client } = build();
    client.get.mockResolvedValueOnce('4').mockResolvedValueOnce(null);

    await expect(store.getVersion('ns')).resolves.toBe(4);
    await expect(store.getVersion('ns')).resolves.toBe(0);
  });

  it('subscribes once and dispatches invalidation messages', async () => {
    const { store, subscriber } = build();
    const handler = jest.fn();

    await store.subscribeInvalidations(handler);
    await store.subscribeInvalidations(handler);

    expect(subscriber.subscribe).toHaveBeenCalledTimes(1);
    expect(subscriber.subscribe).toHaveBeenCalledWith('cache:invalidate');

    subscriber.emit(
      'message',
      'cache:invalidate',
      JSON.stringify({ namespace: 'platform:subscription-plans' }),
    );
    expect(handler).toHaveBeenCalledWith('platform:subscription-plans');

    subscriber.emit('message', 'cache:invalidate', 'not-json');
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('deletes a key and closes both clients', async () => {
    const { store, client, subscriber } = build();

    await store.delete('k');
    expect(client.del).toHaveBeenCalledWith('k');

    await store.close();
    expect(subscriber.quit).toHaveBeenCalled();
    expect(client.quit).toHaveBeenCalled();
  });
});
