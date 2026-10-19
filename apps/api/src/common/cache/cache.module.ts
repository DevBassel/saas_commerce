import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PinoLogger } from 'nestjs-pino';
import { IENV, ICache } from '../config/env.interface';
import { CACHE_STORE } from './cache.types';
import { RedisCacheStore } from './redis-cache.store';
import { ResponseCacheInterceptor } from './response-cache.interceptor';
import { TenantCacheService } from './tenant-cache.service';

@Global()
@Module({
  providers: [
    {
      provide: CACHE_STORE,
      useFactory: (config: ConfigService<IENV>, logger: PinoLogger) => {
        const cache = config.getOrThrow<ICache>('cache');
        return new RedisCacheStore(cache, logger);
      },
      inject: [ConfigService, PinoLogger],
    },
    TenantCacheService,
    ResponseCacheInterceptor,
  ],
  exports: [CACHE_STORE, TenantCacheService, ResponseCacheInterceptor],
})
export class CacheModule {}
