/* eslint-disable @typescript-eslint/unbound-method */
import { CallHandler, Controller, ExecutionContext, Get } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { lastValueFrom, of, throwError } from 'rxjs';
import { Public } from '../../../../modules/auth/decorators/isPublic.decorator';
import { CacheResponse } from '../../cache-response.decorator';
import { ResponseCacheInterceptor } from '../../response-cache.interceptor';

@Controller('products')
class ApprovedTenantController {
  @Get()
  @CacheResponse({ policy: 'products', scope: 'tenant' })
  findAll() {
    return [];
  }
}

@Controller('admin/reports')
class UnapprovedController {
  @Get()
  @CacheResponse({ policy: 'categories', scope: 'tenant' })
  findAll() {
    return [];
  }
}

@Controller('platform/subscription-plans')
class ApprovedPublicController {
  @Get()
  @Public()
  @CacheResponse({ policy: 'plans', scope: 'platform' })
  findAll() {
    return [];
  }
}

@Controller('orders')
class PlainController {
  @Get()
  findAll() {
    return [];
  }
}

const makeRes = () => {
  const headers: Record<string, string> = {};
  const res = {
    statusCode: 200,
    headers,
    setHeader: jest.fn((name: string, value: string) => {
      headers[name.toLowerCase()] = value;
    }),
  };
  return res;
};

const contextFor = (
  controller: { prototype: object },
  handler: (...args: never[]) => unknown,
  req: Record<string, unknown>,
  res: Record<string, unknown>,
): ExecutionContext =>
  ({
    getHandler: () => handler,
    getClass: () => controller,
    switchToHttp: () => ({
      getRequest: () => req,
      getResponse: () => res,
    }),
  }) as unknown as ExecutionContext;

const nextOf = (value: unknown): CallHandler => ({
  handle: () => of(value),
});

const build = () => {
  const cache = {
    fingerprint: jest.fn().mockReturnValue('fp'),
    resolve: jest.fn(),
    hashTenant: jest.fn().mockReturnValue('hash'),
  };
  const logger = { debug: jest.fn(), warn: jest.fn() };
  const interceptor = new ResponseCacheInterceptor(
    new Reflector(),
    cache as never,
    logger as never,
  );
  return { interceptor, cache, logger };
};

describe('ResponseCacheInterceptor', () => {
  it('forces no-store and BYPASS on routes without cache metadata', async () => {
    const { interceptor, cache } = build();
    const res = makeRes();
    const context = contextFor(
      PlainController,
      PlainController.prototype.findAll,
      { method: 'GET', tenant: { schemaName: 'tenant_a' } },
      res,
    );

    await lastValueFrom(interceptor.intercept(context, nextOf(['x'])));

    expect(res.headers['cache-control']).toBe('private, no-store');
    expect(res.headers['x-cache']).toBe('BYPASS');
    expect(cache.resolve).not.toHaveBeenCalled();
  });

  it('bypasses and warns when cache metadata is on an unapproved route', async () => {
    const { interceptor, cache, logger } = build();
    const res = makeRes();
    const context = contextFor(
      UnapprovedController,
      UnapprovedController.prototype.findAll,
      { method: 'GET', tenant: { schemaName: 'tenant_a' } },
      res,
    );

    await lastValueFrom(interceptor.intercept(context, nextOf(['x'])));

    expect(res.headers['cache-control']).toBe('private, no-store');
    expect(res.headers['x-cache']).toBe('BYPASS');
    expect(cache.resolve).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ route: 'GET /admin/reports' }),
      'cache.metadata_not_allowed',
    );
  });

  it('emits HIT and tenant Vary for cached tenant responses', async () => {
    const { interceptor, cache } = build();
    cache.resolve.mockResolvedValue({
      value: ['cached'],
      status: 'hit',
      namespace: 'tenant:tenant_a:products',
      ttlMs: 30000,
      sizeBytes: 10,
    });
    const res = makeRes();
    const context = contextFor(
      ApprovedTenantController,
      ApprovedTenantController.prototype.findAll,
      { method: 'GET', tenant: { schemaName: 'tenant_a' }, query: {} },
      res,
    );

    const value = await lastValueFrom(
      interceptor.intercept(context, nextOf(['fresh'])),
    );

    expect(value).toEqual(['cached']);
    expect(res.headers['cache-control']).toBe('private, no-store');
    expect(res.headers['x-cache']).toBe('HIT');
    expect(res.headers['vary']).toBe('Host, x-tenant-id, x-tenant-slug');
  });

  it('uses a public no-store header for the public platform plan catalog', async () => {
    const { interceptor, cache } = build();
    cache.resolve.mockResolvedValue({
      value: [],
      status: 'miss',
      namespace: 'platform:subscription-plans',
      ttlMs: 300000,
      sizeBytes: 2,
    });
    const res = makeRes();
    const context = contextFor(
      ApprovedPublicController,
      ApprovedPublicController.prototype.findAll,
      { method: 'GET', query: {} },
      res,
    );

    await lastValueFrom(interceptor.intercept(context, nextOf([])));

    expect(res.headers['cache-control']).toBe('public, no-store');
    expect(res.headers['x-cache']).toBe('MISS');
    expect(res.headers.vary).toBeUndefined();
  });

  it('overrides a controller-set permissive Cache-Control header', async () => {
    const { interceptor, cache } = build();
    cache.resolve.mockResolvedValue({
      value: [],
      status: 'miss',
      namespace: 'platform:subscription-plans',
      ttlMs: 300000,
      sizeBytes: 2,
    });
    const res = makeRes();
    res.headers['cache-control'] = 'public, max-age=600';
    const context = contextFor(
      ApprovedPublicController,
      ApprovedPublicController.prototype.findAll,
      { method: 'GET', query: {} },
      res,
    );

    await lastValueFrom(interceptor.intercept(context, nextOf([])));

    expect(res.headers['cache-control']).toBe('public, no-store');
  });

  it('emits BYPASS and no-store when the cache is disabled', async () => {
    const { interceptor, cache } = build();
    cache.resolve.mockResolvedValue({
      value: [],
      status: 'bypass',
      namespace: 'platform:subscription-plans',
      ttlMs: 300000,
      sizeBytes: 2,
    });
    const res = makeRes();
    const context = contextFor(
      ApprovedPublicController,
      ApprovedPublicController.prototype.findAll,
      { method: 'GET', query: {} },
      res,
    );

    await lastValueFrom(interceptor.intercept(context, nextOf([])));

    expect(res.headers['cache-control']).toBe('private, no-store');
    expect(res.headers['x-cache']).toBe('BYPASS');
  });

  it('forces no-store on handler errors', async () => {
    const { interceptor } = build();
    const res = makeRes();
    const context = contextFor(
      PlainController,
      PlainController.prototype.findAll,
      { method: 'GET' },
      res,
    );
    const failing: CallHandler = {
      handle: () => throwError(() => new Error('handler failed')),
    };

    await expect(
      lastValueFrom(interceptor.intercept(context, failing)),
    ).rejects.toThrow('handler failed');
    expect(res.headers['cache-control']).toBe('private, no-store');
  });
});
