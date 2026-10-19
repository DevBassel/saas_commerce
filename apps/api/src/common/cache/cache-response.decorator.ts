import { SetMetadata } from '@nestjs/common';
import { CachePolicyName, CacheScope } from './cache-policy';

export const CACHE_RESPONSE = 'cacheResponse';

export interface CacheResponseMetadata {
  policy: CachePolicyName;
  scope: CacheScope;
}

export const CacheResponse = (metadata: CacheResponseMetadata) =>
  SetMetadata(CACHE_RESPONSE, metadata);
