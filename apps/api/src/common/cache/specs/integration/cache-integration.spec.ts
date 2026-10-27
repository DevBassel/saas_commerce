import {
  CanActivate,
  ClassSerializerInterceptor,
  Controller,
  ExecutionContext,
  Get,
  Inject,
  Injectable,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { Exclude, plainToInstance } from 'class-transformer';
import { PinoLogger } from 'nestjs-pino';
import request from 'supertest';
import type { App } from 'supertest/types';
import { Public } from '../../../../modules/auth/decorators/isPublic.decorator';
import { ICache } from '../../../config/env.interface';
import { CacheResponse } from '../../cache-response.decorator';
import { CACHE_STORE, CacheEntry, CacheStore } from '../../cache.types';
import { ResponseCacheInterceptor } from '../../response-cache.interceptor';
import { TenantCacheService } from '../../tenant-cache.service';

class SecretEntity {
  name = 'plan';

  @Exclude()
  secret = 'should-not-leak';
}

const CALLS = Symbol('CALLS');

type Calls = { count: number };

@Injectable()
class HeaderGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context
      .switchToHttp()
      .getRequest<{ headers: Record<string, string> }>();
    if (req.headers['x-allow'] === '1') return true;
    throw new UnauthorizedException('missing x-allow');
  }
}

@Controller('platform/subscription-plans')
@UseGuards(HeaderGuard)
class DemoController {
  constructor(@Inject(CALLS) private readonly calls: Calls) {}

  @Get()
  @Public()
  @CacheResponse({ policy: 'plans', scope: 'platform' })
  findAll() {
    this.calls.count += 1;
    return plainToInstance(SecretEntity, {
      name: 'plan',
      secret: 'should-not-leak',
    });
  }
}

const CACHE: ICache = {
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
const createStore = (): CacheStore => {
  const entries = new Map<string, unknown>();
  return {
    get: <T>(key: string): Promise<CacheEntry<T> | null> =>
      Promise.resolve(
        entries.has(key)
          ? {
              value: entries.get(key) as T,
              sizeBytes: 0,
            }
          : null,
      ),
    set: <T>(key: string, value: T): Promise<boolean> => {
      entries.set(key, value);
      return Promise.resolve(true);
    },
    invalidateNamespace: (): Promise<number> => {
      const removed = entries.size;
      entries.clear();
      return Promise.resolve(removed);
    },
    getVersion: (): Promise<number> => Promise.resolve(0),
    pingRedis: (): Promise<boolean> => Promise.resolve(true),
  };
};

const logger = {
  debug: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

const config = {
  getOrThrow: jest.fn((key: string) => {
    if (key === 'app') {
      return { apiPrefix: 'api', apiVersion: 'v1' };
    }
    if (key === 'cache') return CACHE;
    throw new Error(`unexpected config group ${key}`);
  }),
};

describe('cache interceptor ordering (Nest integration)', () => {
  it('runs guards before the cache and serializes into it', async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [DemoController],
      providers: [
        HeaderGuard,
        TenantCacheService,
        ResponseCacheInterceptor,
        { provide: CALLS, useValue: { count: 0 } },
        { provide: CACHE_STORE, useValue: createStore() },
        { provide: PinoLogger, useValue: logger },
        { provide: ConfigService, useValue: config },
        { provide: Reflector, useValue: new Reflector() },
      ],
    }).compile();

    const app = moduleRef.createNestApplication();
    app.useGlobalInterceptors(
      app.get(ResponseCacheInterceptor),
      new ClassSerializerInterceptor(app.get(Reflector)),
    );
    await app.init();

    const http = app.getHttpServer() as App;
    const calls = app.get<Calls>(CALLS);

    await request(http).get('/platform/subscription-plans').expect(401);
    expect(calls.count).toBe(0);

    const miss = await request(http)
      .get('/platform/subscription-plans')
      .set('x-allow', '1')
      .expect(200);
    expect(miss.headers['x-cache']).toBe('MISS');
    expect(miss.body).toEqual({ name: 'plan' });
    expect(calls.count).toBe(1);

    const hit = await request(http)
      .get('/platform/subscription-plans')
      .set('x-allow', '1')
      .expect(200);
    expect(hit.headers['x-cache']).toBe('HIT');
    expect(hit.body).toEqual({ name: 'plan' });
    expect(calls.count).toBe(1);

    const secondHit = await request(http)
      .get('/platform/subscription-plans')
      .set('x-allow', '1')
      .expect(200);
    expect(secondHit.headers['x-cache']).toBe('HIT');
    expect(secondHit.body).toEqual({ name: 'plan' });
    expect(calls.count).toBe(1);

    await app.close();
  });
});
