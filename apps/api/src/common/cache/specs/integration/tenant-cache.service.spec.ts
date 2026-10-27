/* eslint-disable @typescript-eslint/unbound-method */
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import { IENV } from '../../../config/env.interface';
import { TenantCacheService } from '../../tenant-cache.service';
import { CacheEntry, CacheStore } from '../../cache.types';

const CACHE = {
  enabled: true,
  maxEntryBytes: 262144,
  maxInflight: 100,
  operationTimeoutMs: 50,
  productsTtlSeconds: 30,
  categoriesTtlSeconds: 300,
  plansTtlSeconds: 300,
  redis: {
    url: undefined,
    tls: false,
    connectTimeoutMs: 1000,
    commandTimeoutMs: 50,
    safetyTtlSeconds: 600,
  },
};

/** Minimal in-memory CacheStore test double; production only ships Redis. */
class FakeCacheStore implements CacheStore {
  private readonly entries = new Map<string, unknown>();
  private readonly namespaces = new Map<string, string>();
  private readonly versions = new Map<string, number>();

  get<T>(key: string): Promise<CacheEntry<T> | null> {
    if (!this.entries.has(key)) return Promise.resolve(null);
    return Promise.resolve({
      value: this.entries.get(key) as T,
      sizeBytes: 0,
    });
  }

  set<T>(
    key: string,
    value: T,
    _ttlMs: number,
    _sizeBytes: number,
    namespace: string,
    expectedVersion?: number,
  ): Promise<boolean> {
    const current = this.versions.get(namespace) ?? 0;
    if (expectedVersion !== undefined && expectedVersion !== current) {
      return Promise.resolve(false);
    }
    this.entries.set(key, value);
    this.namespaces.set(key, namespace);
    return Promise.resolve(true);
  }

  invalidateNamespace(namespace: string): Promise<number> {
    this.versions.set(namespace, (this.versions.get(namespace) ?? 0) + 1);
    let removed = 0;
    for (const [key, keyNamespace] of this.namespaces) {
      if (keyNamespace !== namespace) continue;
      this.entries.delete(key);
      this.namespaces.delete(key);
      removed += 1;
    }
    return Promise.resolve(removed);
  }

  getVersion(namespace: string): Promise<number> {
    return Promise.resolve(this.versions.get(namespace) ?? 0);
  }

  pingRedis(): Promise<boolean> {
    return Promise.resolve(true);
  }
}

const logger = {
  debug: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

const buildConfig = (
  cacheOverrides: Partial<typeof CACHE> = {},
): ConfigService<IENV> =>
  ({
    getOrThrow: jest.fn((key: string) => {
      if (key === 'app') {
        return { apiPrefix: 'api', apiVersion: 'v1' };
      }
      if (key === 'cache') return { ...CACHE, ...cacheOverrides };
      throw new Error(`unexpected config group ${key}`);
    }),
  }) as unknown as ConfigService<IENV>;

const build = (cacheOverrides: Partial<typeof CACHE> = {}) => {
  const store = new FakeCacheStore();
  const service = new TenantCacheService(
    store,
    buildConfig(cacheOverrides),
    logger as never,
  );
  return { store, service };
};

const deferred = <T>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

const flush = () => new Promise((resolve) => setImmediate(resolve));

describe('TenantCacheService', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('fingerprints and keys', () => {
    it('distinguishes pagination, sort, repeated query values, and params', () => {
      const { service } = build();
      const base = { method: 'GET', route: 'GET /products' };

      const page1 = service.fingerprint({
        ...base,
        query: { page: '1', limit: '10' },
      });
      const page2 = service.fingerprint({
        ...base,
        query: { page: '2', limit: '10' },
      });
      const sorted = service.fingerprint({
        ...base,
        query: { sortBy: 'price', sortOrder: 'asc' },
      });
      const repeatedA = service.fingerprint({
        ...base,
        query: { tag: ['a', 'b'] },
      });
      const repeatedB = service.fingerprint({
        ...base,
        query: { tag: ['b', 'a'] },
      });
      const params = service.fingerprint({
        ...base,
        route: 'GET /products/:id',
        params: { id: '5' },
      });

      expect(page1).not.toBe(page2);
      expect(sorted).not.toBe(page1);
      expect(repeatedA).toBe(repeatedB);
      expect(params).not.toBe(page1);
    });

    it('separates literal search delimiters from separate filter parameters', () => {
      const { service } = build();
      const base = { method: 'GET', route: 'GET /products' };
      const literal = Object.fromEntries(
        new URLSearchParams('search=shirt%26sortBy%3Dprice&page=1&limit=12'),
      );
      const sorted = Object.fromEntries(
        new URLSearchParams('search=shirt&sortBy=price&page=1&limit=12'),
      );

      expect(service.fingerprint({ ...base, query: literal })).not.toBe(
        service.fingerprint({ ...base, query: sorted }),
      );
    });

    it.each([
      [{ search: '[a,b]' }, { search: ['a', 'b'] }],
      [{ search: ['a,b', 'c'] }, { search: ['a', 'b,c'] }],
      [{ search: '{a:b}' }, { search: { a: 'b' } }],
      [{ search: { a: 'b,c:d' } }, { search: { a: 'b', c: 'd' } }],
      [{ search: { 'a:b': 'c' } }, { search: { a: 'b:c' } }],
      [
        { 'search=shirt&sortBy': 'price' },
        { search: 'shirt', sortBy: 'price' },
      ],
      [{ search: '[]' }, { search: [] }],
      [{ search: '{}' }, { search: {} }],
      [{ search: 'null' }, { search: null }],
      [{ search: 'undefined' }, { search: undefined }],
      [{ minPrice: '1' }, { minPrice: 1 }],
      [{ inStock: 'true' }, { inStock: true }],
      [{ search: ['a'] }, { search: ['a', 'a'] }],
    ])('preserves scalar types and container boundaries: %j vs %j', (a, b) => {
      const { service } = build();
      const base = { method: 'GET', route: 'GET /products' };

      expect(service.fingerprint({ ...base, query: a })).not.toBe(
        service.fingerprint({ ...base, query: b }),
      );
    });

    it('normalizes method, query keys, nested object keys, and repeated-value order', () => {
      const { service } = build();

      expect(
        service.fingerprint({
          method: 'get',
          route: 'GET /products',
          query: {
            search: 'shirt',
            nested: { a: ['one', 'two'], b: 'three' },
            categoryId: '3',
          },
        }),
      ).toBe(
        service.fingerprint({
          method: 'GET',
          route: 'GET /products',
          query: {
            categoryId: '3',
            nested: { b: 'three', a: ['two', 'one'] },
            search: 'shirt',
          },
        }),
      );
    });

    it.each([
      ['search', 'hat'],
      ['categoryId', '4'],
      ['minPrice', '1'],
      ['maxPrice', '30'],
      ['inStock', 'false'],
      ['sortBy', 'name'],
      ['sortOrder', 'desc'],
      ['page', '2'],
      ['limit', '10'],
    ])('distinguishes a change to the %s filter', (field, value) => {
      const { service } = build();
      const base = { method: 'GET', route: 'GET /products' };
      const query = {
        search: 'shirt',
        categoryId: '3',
        minPrice: '0',
        maxPrice: '20',
        inStock: 'true',
        sortBy: 'price',
        sortOrder: 'asc',
        page: '1',
        limit: '12',
      };

      expect(service.fingerprint({ ...base, query })).not.toBe(
        service.fingerprint({ ...base, query: { ...query, [field]: value } }),
      );
    });

    it('preserves boundaries between route, params, and query', () => {
      const { service } = build();
      const query = { search: 'shirt' };

      expect(
        service.fingerprint({
          method: 'GET',
          route: 'GET /products\nid=1',
          query,
        }),
      ).not.toBe(
        service.fingerprint({
          method: 'GET',
          route: 'GET /products',
          params: { id: '1\n' },
          query,
        }),
      );
    });

    it('does not reuse a legacy delimiter-based fingerprint', () => {
      const { service } = build();
      const legacy = createHash('sha256')
        .update(
          'GET\nGET /products\n\nlimit=12&page=1&search=shirt&sortBy=price',
        )
        .digest('hex');

      expect(
        service.fingerprint({
          method: 'GET',
          route: 'GET /products',
          query: { search: 'shirt', sortBy: 'price', page: '1', limit: '12' },
        }),
      ).not.toBe(legacy);
    });

    it("never returns another filter request or tenant's cached response", async () => {
      const { service } = build();
      const base = { method: 'GET', route: 'GET /products' };
      const literal = service.fingerprint({
        ...base,
        query: { search: 'shirt&sortBy=price', page: '1', limit: '12' },
      });
      const sorted = service.fingerprint({
        ...base,
        query: { search: 'shirt', sortBy: 'price', page: '1', limit: '12' },
      });
      const literalLoader = jest.fn().mockResolvedValue(['literal result']);
      const sortedLoader = jest.fn().mockResolvedValue(['sorted result']);
      const otherTenantLoader = jest.fn().mockResolvedValue(['other tenant']);

      for (const status of ['miss', 'hit']) {
        await expect(
          service.resolve(
            'tenant',
            'tenant_a',
            'products',
            literal,
            literalLoader,
          ),
        ).resolves.toMatchObject({ status, value: ['literal result'] });
        await expect(
          service.resolve(
            'tenant',
            'tenant_a',
            'products',
            sorted,
            sortedLoader,
          ),
        ).resolves.toMatchObject({ status, value: ['sorted result'] });
        await expect(
          service.resolve(
            'tenant',
            'tenant_b',
            'products',
            sorted,
            otherTenantLoader,
          ),
        ).resolves.toMatchObject({ status, value: ['other tenant'] });
      }

      expect(literalLoader).toHaveBeenCalledTimes(1);
      expect(sortedLoader).toHaveBeenCalledTimes(1);
      expect(otherTenantLoader).toHaveBeenCalledTimes(1);
    });

    it('bypasses when canonical input exceeds 8 KiB', () => {
      const { service } = build();
      const fingerprint = service.fingerprint({
        method: 'GET',
        route: 'GET /products',
        query: { q: 'x'.repeat(9000) },
      });
      expect(fingerprint).toBeNull();
    });

    it('separates tenant and platform namespaces', () => {
      const { service } = build();
      const tenantKey = service.keyFor('tenant', 'tenant_a', 'products', 'fp');
      const otherTenantKey = service.keyFor(
        'tenant',
        'tenant_b',
        'products',
        'fp',
      );
      const platformKey = service.keyFor('platform', undefined, 'plans', 'fp');

      expect(tenantKey).toContain(':tenant:tenant_a:products:');
      expect(tenantKey).not.toBe(otherTenantKey);
      expect(platformKey).toContain(':platform:subscription-plans:');
      expect(tenantKey).not.toBe(platformKey);
    });
  });

  describe('single flight', () => {
    it('loads concurrent misses once', async () => {
      const { service } = build();
      const gate = deferred<string>();
      const loader = jest.fn(() => gate.promise);

      const first = service.resolve(
        'platform',
        undefined,
        'plans',
        'fp',
        loader,
      );
      const second = service.resolve(
        'platform',
        undefined,
        'plans',
        'fp',
        loader,
      );
      await flush();
      gate.resolve('value');

      await expect(first).resolves.toMatchObject({ value: 'value' });
      await expect(second).resolves.toMatchObject({ value: 'value' });
      expect(loader).toHaveBeenCalledTimes(1);
    });

    it('retries after a loader rejection', async () => {
      const { service } = build();
      const loader = jest
        .fn()
        .mockRejectedValueOnce(new Error('boom'))
        .mockResolvedValueOnce('ok');

      await expect(
        service.resolve('platform', undefined, 'plans', 'fp', loader),
      ).rejects.toThrow('boom');

      await expect(
        service.resolve('platform', undefined, 'plans', 'fp', loader),
      ).resolves.toMatchObject({ value: 'ok' });
      expect(loader).toHaveBeenCalledTimes(2);
    });

    it('bypasses safely when the in-flight cap is reached', async () => {
      const { service } = build({ maxInflight: 1 });
      const gate = deferred<string>();
      const firstLoader = jest.fn(() => gate.promise);
      const secondLoader = jest.fn().mockResolvedValue('direct');

      const first = service.resolve(
        'platform',
        undefined,
        'plans',
        'fp-one',
        firstLoader,
      );
      await flush();

      await expect(
        service.resolve('platform', undefined, 'plans', 'fp-two', secondLoader),
      ).resolves.toMatchObject({ value: 'direct', status: 'bypass' });
      expect(secondLoader).toHaveBeenCalledTimes(1);

      gate.resolve('first');
      await first;
    });

    it('prevents a stale flight from writing and retries once', async () => {
      const { service, store } = build();
      const gate = deferred<string>();
      let calls = 0;
      const loader = jest.fn(() => {
        calls += 1;
        return calls === 1 ? gate.promise : Promise.resolve('fresh');
      });

      const result = service.resolve(
        'platform',
        undefined,
        'plans',
        'fp',
        loader,
      );
      await flush();

      await service.invalidatePlans();
      gate.resolve('stale');

      await expect(result).resolves.toMatchObject({ value: 'fresh' });
      expect(loader).toHaveBeenCalledTimes(2);

      const key = service.keyFor('platform', undefined, 'plans', 'fp')!;
      await expect(store.get(key)).resolves.toMatchObject({
        value: 'fresh',
      });
    });

    it('does not cache or retry an oversized value', async () => {
      const { service, store } = build();
      const setSpy = jest.spyOn(store, 'set');
      const value = 'x'.repeat(300_000);
      const loader = jest.fn().mockResolvedValue(value);

      await expect(
        service.resolve('platform', undefined, 'plans', 'fp', loader),
      ).resolves.toMatchObject({ value });
      expect(loader).toHaveBeenCalledTimes(1);
      expect(setSpy).not.toHaveBeenCalled();
    });

    it('retries once when the store rejects a stale write', async () => {
      const store = {
        get: jest.fn().mockResolvedValue(null),
        getVersion: jest.fn().mockResolvedValue(0),
        set: jest.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true),
        invalidateNamespace: jest.fn(),
      } as unknown as CacheStore;
      const service = new TenantCacheService(
        store,
        buildConfig(),
        logger as never,
      );
      let calls = 0;
      const loader = jest.fn(() => Promise.resolve(`v${(calls += 1)}`));

      await expect(
        service.resolve('platform', undefined, 'plans', 'fp', loader),
      ).resolves.toMatchObject({ value: 'v2' });
      expect(loader).toHaveBeenCalledTimes(2);
      expect(store.set).toHaveBeenCalledTimes(2);
    });

    it('never replaces a newer flight with an older result', async () => {
      const { service, store } = build();
      const firstGate = deferred<string>();
      const secondGate = deferred<string>();
      let calls = 0;
      const loader = jest.fn(() => {
        calls += 1;
        if (calls === 1) return firstGate.promise;
        if (calls === 2) return secondGate.promise;
        return Promise.resolve('fresh');
      });

      const oldFlight = service.resolve(
        'platform',
        undefined,
        'plans',
        'fp',
        loader,
      );
      await flush();

      await service.invalidatePlans();
      const newFlight = service.resolve(
        'platform',
        undefined,
        'plans',
        'fp',
        loader,
      );
      await flush();
      secondGate.resolve('fresh');
      await expect(newFlight).resolves.toMatchObject({ value: 'fresh' });

      firstGate.resolve('stale');
      await expect(oldFlight).resolves.toMatchObject({ value: 'fresh' });

      const key = service.keyFor('platform', undefined, 'plans', 'fp')!;
      await expect(store.get(key)).resolves.toMatchObject({ value: 'fresh' });
    });

    it('keeps a replacement flight tracked for a later invalidation', async () => {
      const { service, store } = build();
      const firstGate = deferred<string>();
      const secondGate = deferred<string>();
      let calls = 0;
      const loader = jest.fn(() => {
        calls += 1;
        if (calls === 1) return firstGate.promise;
        if (calls === 2) return secondGate.promise;
        return Promise.resolve('fresh');
      });

      const oldFlight = service.resolve(
        'platform',
        undefined,
        'plans',
        'fp',
        loader,
      );
      await flush();

      await service.invalidatePlans();
      const replacementFlight = service.resolve(
        'platform',
        undefined,
        'plans',
        'fp',
        loader,
      );
      await flush();

      firstGate.resolve('stale-one');
      await flush();
      await service.invalidatePlans();
      secondGate.resolve('stale-two');

      await expect(replacementFlight).resolves.toMatchObject({
        value: 'fresh',
      });
      await expect(oldFlight).resolves.toMatchObject({ value: 'fresh' });
      expect(loader).toHaveBeenCalledTimes(3);

      const key = service.keyFor('platform', undefined, 'plans', 'fp')!;
      await expect(store.get(key)).resolves.toMatchObject({ value: 'fresh' });
    });
  });

  describe('fail-open behaviour', () => {
    it('serves the loader when the cache is disabled', async () => {
      const { service } = build({ enabled: false });
      const loader = jest.fn().mockResolvedValue('value');

      await expect(
        service.resolve('platform', undefined, 'plans', 'fp', loader),
      ).resolves.toMatchObject({ value: 'value', status: 'bypass' });
      expect(loader).toHaveBeenCalledTimes(1);
    });

    it('serves the loader when the store read fails', async () => {
      const store = {
        get: jest.fn().mockRejectedValue(new Error('read failed')),
        set: jest.fn().mockResolvedValue(true),
        invalidateNamespace: jest.fn(),
        getVersion: jest.fn().mockResolvedValue(0),
      } as unknown as CacheStore;
      const service = new TenantCacheService(
        store,
        buildConfig(),
        logger as never,
      );

      await expect(
        service.resolve(
          'platform',
          undefined,
          'plans',
          'fp',
          jest.fn().mockResolvedValue('value'),
        ),
      ).resolves.toMatchObject({ value: 'value' });
    });

    it('returns the loaded value when the store write fails', async () => {
      const store = {
        get: jest.fn().mockResolvedValue(null),
        set: jest.fn().mockRejectedValue(new Error('write failed')),
        invalidateNamespace: jest.fn(),
        getVersion: jest.fn().mockResolvedValue(0),
      } as unknown as CacheStore;
      const service = new TenantCacheService(
        store,
        buildConfig(),
        logger as never,
      );

      await expect(
        service.resolve(
          'platform',
          undefined,
          'plans',
          'fp',
          jest.fn().mockResolvedValue('value'),
        ),
      ).resolves.toMatchObject({ value: 'value' });
    });

    it('times out store reads and falls back to the loader', async () => {
      const store = {
        get: jest.fn(() => new Promise(() => undefined)),
        set: jest.fn().mockResolvedValue(true),
        invalidateNamespace: jest.fn().mockResolvedValue(0),
        getVersion: jest.fn().mockResolvedValue(0),
      } as unknown as CacheStore;
      const service = new TenantCacheService(
        store,
        buildConfig({ operationTimeoutMs: 5 }),
        logger as never,
      );

      await expect(
        service.resolve(
          'platform',
          undefined,
          'plans',
          'fp',
          jest.fn().mockResolvedValue('value'),
        ),
      ).resolves.toMatchObject({ value: 'value' });
    });

    it('never throws when invalidation fails', async () => {
      const store = {
        get: jest.fn(),
        set: jest.fn(),
        invalidateNamespace: jest.fn().mockRejectedValue(new Error('down')),
        getVersion: jest.fn(),
      } as unknown as CacheStore;
      const service = new TenantCacheService(
        store,
        buildConfig(),
        logger as never,
      );

      await expect(service.invalidatePlans()).resolves.toBeUndefined();
    });
  });
});
