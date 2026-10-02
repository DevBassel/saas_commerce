import {
  BadRequestException,
  ExecutionContext,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { TenantResolutionService } from 'src/modules/tenants/services/tenant-resolution.service';
import { TENANT_INACTIVE_MESSAGE } from 'src/modules/tenants/tenant-policy';
import { TenantStatus } from 'src/modules/tenants/enums/tenantStatus.enum';
import { Tenant } from 'src/modules/tenants/entities/tenant.entity';
import { IS_PLATFORM } from '../decorators/isPlatform.decorator';
import { RequestWithUser } from '../interfaces/RequestWithUser.interface';
import { TenantGuard } from './tenant.guard';

const buildReflector = (isPlatform = false) =>
  ({
    getAllAndOverride: jest.fn((key: unknown) =>
      key === IS_PLATFORM ? isPlatform : undefined,
    ),
  }) as unknown as Reflector;

const buildContext = (request: Record<string, unknown>): ExecutionContext =>
  ({
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({ getRequest: () => request }),
  }) as unknown as ExecutionContext;

const tenantEntity = (status: TenantStatus): Tenant =>
  ({ id: 10, schemaName: 'tenant_acme', status }) as Tenant;

describe('TenantGuard', () => {
  const makeResolution = (opts: {
    isApiPath?: boolean;
    hasTenantIdentifier?: boolean;
  }) =>
    ({
      isApiPath: jest.fn(() => opts.isApiPath ?? true),
      hasTenantIdentifier: jest.fn(() => opts.hasTenantIdentifier ?? true),
    }) as unknown as TenantResolutionService;

  it('passes through non-API URLs', () => {
    const guard = new TenantGuard(
      buildReflector(),
      makeResolution({ isApiPath: false }),
    );

    expect(
      guard.canActivate(buildContext({ originalUrl: '/assets/logo.png' })),
    ).toBe(true);
  });

  it('bypasses @Platform routes before any URL or tenant check', () => {
    const resolution = makeResolution({ isApiPath: true });
    const guard = new TenantGuard(buildReflector(true), resolution);

    expect(
      guard.canActivate(buildContext({ originalUrl: '/api/v1/platform' })),
    ).toBe(true);
    expect(
      (resolution as unknown as { isApiPath: jest.Mock }).isApiPath,
    ).not.toHaveBeenCalled();
  });

  it('throws BadRequest when an API request has no tenant identifier', () => {
    const guard = new TenantGuard(
      buildReflector(),
      makeResolution({ isApiPath: true, hasTenantIdentifier: false }),
    );

    expect(() =>
      guard.canActivate(buildContext({ originalUrl: '/api/v1/products' })),
    ).toThrow(BadRequestException);
  });

  it('throws NotFound when an identifier is present but does not resolve', () => {
    const guard = new TenantGuard(
      buildReflector(),
      makeResolution({ isApiPath: true, hasTenantIdentifier: true }),
    );

    expect(() =>
      guard.canActivate(buildContext({ originalUrl: '/api/v1/products' })),
    ).toThrow(NotFoundException);
  });

  it('allows an ACTIVE resolved tenant and sets it on the request', () => {
    const request: Record<string, unknown> = {
      originalUrl: '/api/v1/products',
      tenant: tenantEntity(TenantStatus.ACTIVE),
    };
    const guard = new TenantGuard(buildReflector(), makeResolution({}));

    expect(guard.canActivate(buildContext(request))).toBe(true);
    expect((request as { tenant?: Tenant }).tenant).toEqual(
      tenantEntity(TenantStatus.ACTIVE),
    );
  });

  it('forbids an INACTIVE tenant with the shared message', () => {
    const guard = new TenantGuard(buildReflector(), makeResolution({}));

    try {
      guard.canActivate(
        buildContext({
          originalUrl: '/api/v1/products',
          tenant: tenantEntity(TenantStatus.INACTIVE),
        }),
      );
      fail('expected ForbiddenException');
    } catch (error) {
      expect(error).toBeInstanceOf(ForbiddenException);
      expect((error as ForbiddenException).message).toBe(
        TENANT_INACTIVE_MESSAGE,
      );
    }
  });

  it('falls back to request.url when originalUrl is absent', () => {
    const guard = new TenantGuard(
      buildReflector(),
      makeResolution({ isApiPath: false }),
    );

    expect(guard.canActivate(buildContext({ url: '/assets/x' }))).toBe(true);
  });

  it('propagates the resolved tenant to RequestWithUser typing', () => {
    const request = {
      originalUrl: '/api/v1/products',
      tenant: tenantEntity(TenantStatus.ACTIVE),
    } as unknown as RequestWithUser;
    const guard = new TenantGuard(buildReflector(), makeResolution({}));

    expect(
      guard.canActivate(
        buildContext(request as unknown as Record<string, unknown>),
      ),
    ).toBe(true);
    expect(request.tenant?.schemaName).toBe('tenant_acme');
  });
});
