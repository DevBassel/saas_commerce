export interface CacheEntry<T = unknown> {
  value: T;
  expiresAt: number;
  sizeBytes: number;
  namespace: string;
}

export type InvalidationHandler = (namespace: string) => void;

export interface CacheStore {
  get<T>(key: string): Promise<CacheEntry<T> | null>;
  /**
   * Returns true when the value was written. Redis returns false when the
   * namespace version changed while the loader was running, which lets the
   * caller retry once without caching a pre-invalidation result.
   */
  set<T>(
    key: string,
    value: T,
    ttlMs: number,
    sizeBytes: number,
    namespace: string,
    expectedVersion?: number,
  ): Promise<boolean>;
  delete(key: string): Promise<void>;
  invalidateNamespace(namespace: string): Promise<number>;
  getVersion(namespace: string): Promise<number>;
  /** Optional cross-instance invalidation subscription (Redis). */
  subscribeInvalidations?(handler: InvalidationHandler): Promise<void>;
  /** Optional lifecycle hook for network clients. */
  close?(): Promise<void>;
}

export const CACHE_STORE = Symbol('CACHE_STORE');

export type CacheStatus = 'hit' | 'miss' | 'bypass';

export interface CacheResolveResult<T> {
  value: T;
  status: CacheStatus;
  namespace: string | null;
  ttlMs: number;
  sizeBytes: number;
}
