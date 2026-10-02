import { NextFunction, Request, Response } from 'express';
import { Tenant } from '../tenants/entities/tenant.entity';
import { TenantResolutionService } from '../tenants/services/tenant-resolution.service';
import { getTenantContext } from './tenant-context';
import { TenantMiddleware } from './tenant.middleware';

const tenant = { id: 10, schemaName: 'tenant_acme' } as Tenant;

interface ResolutionMock {
  isApiPath: jest.Mock;
  resolveFromRequest: jest.Mock;
}

const makeResolution = (opts: {
  isApiPath?: boolean;
  tenant?: Tenant | undefined;
}): ResolutionMock => ({
  isApiPath: jest.fn(() => opts.isApiPath ?? true),
  resolveFromRequest: jest
    .fn()
    .mockResolvedValue('tenant' in opts ? opts.tenant : tenant),
});

const asResolution = (mock: ResolutionMock): TenantResolutionService =>
  mock as unknown as TenantResolutionService;

const request = (overrides: Record<string, unknown> = {}) =>
  ({ originalUrl: '/api/v1/products', headers: {}, ...overrides }) as Request;

describe('TenantMiddleware', () => {
  it('skips resolution for non-API paths', async () => {
    const resolution = makeResolution({ isApiPath: false });
    const middleware = new TenantMiddleware(asResolution(resolution));
    const next = jest.fn();

    await middleware.use(
      request({ originalUrl: '/assets/logo.png' }),
      {} as Response,
      next as NextFunction,
    );

    expect(next).toHaveBeenCalledTimes(1);
    expect(resolution.resolveFromRequest).not.toHaveBeenCalled();
  });

  it('calls next without a tenant when the request does not resolve', async () => {
    const resolution = makeResolution({ isApiPath: true, tenant: undefined });
    const middleware = new TenantMiddleware(asResolution(resolution));
    const next = jest.fn();

    const req = request();
    await middleware.use(req, {} as Response, next as NextFunction);

    expect(next).toHaveBeenCalledTimes(1);
    expect((req as Request & { tenant?: Tenant }).tenant).toBeUndefined();
  });

  it('sets req.tenant and runs next inside the ALS store', async () => {
    const resolution = makeResolution({ isApiPath: true, tenant });
    const middleware = new TenantMiddleware(asResolution(resolution));
    let store: ReturnType<typeof getTenantContext>;
    const next = jest.fn(() => {
      store = getTenantContext();
    });

    const req = request();
    await middleware.use(req, {} as Response, next as NextFunction);

    expect((req as Request & { tenant?: Tenant }).tenant).toBe(tenant);
    expect(store).toEqual({ tenant, tenantSchema: 'tenant_acme' });
    expect(getTenantContext()).toBeUndefined();
  });

  it('uses request.url when originalUrl is missing', async () => {
    const resolution = makeResolution({ isApiPath: true, tenant });
    const middleware = new TenantMiddleware(asResolution(resolution));
    const next = jest.fn();

    await middleware.use(
      request({ originalUrl: undefined, url: '/api/v1/products' }),
      {} as Response,
      next as NextFunction,
    );

    expect(resolution.isApiPath).toHaveBeenCalledWith('/api/v1/products');
    expect(next).toHaveBeenCalledTimes(1);
  });
});
