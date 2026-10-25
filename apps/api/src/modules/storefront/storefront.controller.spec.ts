import { ClassSerializerInterceptor, ValidationPipe } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import type { NextFunction, Request, Response } from 'express';
import { PinoLogger } from 'nestjs-pino';
import request from 'supertest';
import type { App } from 'supertest/types';
import type { FindManyOptions } from 'typeorm';
import { ResponseCacheInterceptor } from '../../common/cache/response-cache.interceptor';
import { TenantCacheService } from '../../common/cache/tenant-cache.service';
import type { JwtPayload } from '../auth/dto/jwt-payload.dto';
import { EmailVerifiedGuard } from '../auth/guards/email-verified.guard';
import { JwtGuard } from '../auth/guards/jwt.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { TenantGuard } from '../auth/guards/tenant.guard';
import { TenantMiddleware } from '../auth/tenant.middleware';
import { CategoriesController } from '../categories/categories.controller';
import { CategoriesService } from '../categories/categories.service';
import { Category } from '../categories/entities/category.entity';
import { Tenant } from '../tenants/entities/tenant.entity';
import { TenantStatus } from '../tenants/enums/tenantStatus.enum';
import { TenantManagerService } from '../tenants/services/tenant-manager.service';
import { TenantResolutionService } from '../tenants/services/tenant-resolution.service';
import { TenantService } from '../tenants/tenant.service';
import type { TenantRef } from '../tenants/utils/tenant.utils';
import { UsersService } from '../users/users.service';
import { StorefrontController } from './storefront.controller';

const categoryRow = (id: number, name: string) => ({
  id,
  name,
  slug: name.toLowerCase(),
  description: null,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
});

const createRepository = () => ({
  find: jest.fn<
    Promise<Array<Record<string, unknown>>>,
    [FindManyOptions<Category>]
  >(),
});

describe('StorefrontController (Nest HTTP integration)', () => {
  let app: INestApplication;
  let http: App;
  let usersService: { findOne: jest.Mock };

  const alpha = Object.assign(new Tenant(), {
    id: 1,
    name: 'Alpha Store',
    slug: 'alpha',
    schemaName: 'tenant_alpha',
    status: TenantStatus.ACTIVE,
    currency: 'usd',
  });
  const beta = Object.assign(new Tenant(), {
    id: 2,
    name: 'Beta Store',
    slug: 'beta',
    schemaName: 'tenant_beta',
    status: TenantStatus.ACTIVE,
    currency: 'eur',
  });

  const alphaRepo = createRepository();
  const betaRepo = createRepository();
  const getRepository = jest.fn((entity: unknown, tenant: TenantRef) => {
    if (entity !== Category) throw new Error('Unexpected tenant repository');
    if (tenant.schemaName === alpha.schemaName) {
      return Promise.resolve(alphaRepo);
    }
    if (tenant.schemaName === beta.schemaName) {
      return Promise.resolve(betaRepo);
    }
    throw new Error('Unexpected tenant repository');
  });

  const payloads: Record<string, JwtPayload> = {
    'token-alpha': {
      type: 'access',
      id: 1,
      role: 'ADMIN',
      tenantId: alpha.id,
      tenantSchema: alpha.schemaName,
    },
    'token-beta': {
      type: 'access',
      id: 1,
      role: 'ADMIN',
      tenantId: beta.id,
      tenantSchema: beta.schemaName,
    },
    'token-unverified': {
      type: 'access',
      id: 2,
      role: 'CUSTOMER',
      tenantId: alpha.id,
      tenantSchema: alpha.schemaName,
    },
  };

  const users: Record<number, Record<string, unknown>> = {
    1: {
      id: 1,
      name: 'Owner',
      email: 'owner@alpha.test',
      emailVerified: true,
      role: { id: 1, key: 'ADMIN', permissions: [] },
      permissions: [],
    },
    2: {
      id: 2,
      name: 'Unverified',
      email: 'unverified@alpha.test',
      emailVerified: false,
      role: { id: 2, key: 'CUSTOMER', permissions: [] },
      permissions: [],
    },
  };

  const storefrontCategories = (slug: string) =>
    request(http).get('/api/v1/store/categories').set('x-tenant-slug', slug);

  beforeAll(async () => {
    usersService = {
      findOne: jest.fn((where: { id: number }) =>
        Promise.resolve(users[where.id] ?? null),
      ),
    };
    const tenants = [alpha, beta];
    const moduleRef = await Test.createTestingModule({
      controllers: [StorefrontController, CategoriesController],
      providers: [
        CategoriesService,
        TenantResolutionService,
        TenantMiddleware,
        TenantGuard,
        JwtGuard,
        EmailVerifiedGuard,
        PermissionGuard,
        ResponseCacheInterceptor,
        { provide: TenantManagerService, useValue: { getRepository } },
        {
          provide: TenantService,
          useValue: {
            findById: (id: number) =>
              Promise.resolve(tenants.find((tenant) => tenant.id === id)),
            findBySlug: (slug: string) =>
              Promise.resolve(tenants.find((tenant) => tenant.slug === slug)),
            findBySubdomain: (slug: string) =>
              Promise.resolve(tenants.find((tenant) => tenant.slug === slug)),
          },
        },
        { provide: UsersService, useValue: usersService },
        {
          provide: JwtService,
          useValue: {
            verify: (token: string) => {
              const payload = payloads[token];
              if (!payload) throw new Error('Invalid token');
              return payload;
            },
          },
        },
        {
          provide: TenantCacheService,
          useValue: {
            invalidateCategories: jest.fn(),
            invalidateProducts: jest.fn(),
            fingerprint: jest.fn(() => 'fingerprint'),
            resolve: jest.fn(),
            hashTenant: jest.fn(() => 'tenant-hash'),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: (key: string) => {
              if (key === 'app') {
                return {
                  apiPrefix: 'api',
                  apiVersion: 'v1',
                  rootDomain: 'catalog.test',
                };
              }
              if (key === 'jwt') {
                return {
                  accessSecret: 'access-secret',
                  accessExpiresIn: '15m',
                  refreshSecret: 'refresh-secret',
                  refreshExpiresIn: '7d',
                  issuer: 'test',
                  audience: 'test',
                };
              }
              throw new Error(`Unexpected config group ${key}`);
            },
          },
        },
        {
          provide: PinoLogger,
          useValue: { debug: jest.fn(), warn: jest.fn(), error: jest.fn() },
        },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    const middleware = app.get(TenantMiddleware);
    app.use((req: Request, res: Response, next: NextFunction) => {
      void middleware.use(req, res, next).catch(next);
    });
    app.useGlobalGuards(
      app.get(TenantGuard),
      app.get(JwtGuard),
      app.get(EmailVerifiedGuard),
      app.get(PermissionGuard),
    );
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalInterceptors(
      app.get(ResponseCacheInterceptor),
      new ClassSerializerInterceptor(app.get(Reflector)),
    );
    await app.init();
    http = app.getHttpServer() as App;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    alpha.status = TenantStatus.ACTIVE;
    beta.status = TenantStatus.ACTIVE;
    alphaRepo.find.mockResolvedValue([
      categoryRow(1, 'Alpha Home'),
      categoryRow(2, 'Alpha Books'),
    ]);
    betaRepo.find.mockResolvedValue([categoryRow(1, 'Beta Home')]);
  });

  afterAll(async () => {
    await app.close();
  });

  it('serves active category options without auth and projects two fields', async () => {
    const response = await storefrontCategories('alpha').expect(200);

    expect(response.body).toEqual([
      { id: 1, name: 'Alpha Home' },
      { id: 2, name: 'Alpha Books' },
    ]);
    expect(alphaRepo.find).toHaveBeenCalledWith({
      where: { isActive: true },
      select: { id: true, name: true },
      order: { name: 'ASC', id: 'ASC' },
    });
    expect(response.headers['cache-control']).toBe('private, no-store');
    expect(response.headers['x-cache']).toBe('BYPASS');
  });

  it('returns an empty list when the tenant has no active categories', async () => {
    alphaRepo.find.mockResolvedValue([]);

    const response = await storefrontCategories('alpha').expect(200);

    expect(response.body).toEqual([]);
  });

  it('isolates category options by tenant', async () => {
    const a = await storefrontCategories('alpha').expect(200);
    const b = await storefrontCategories('beta').expect(200);

    expect(a.body).toEqual([
      { id: 1, name: 'Alpha Home' },
      { id: 2, name: 'Alpha Books' },
    ]);
    expect(b.body).toEqual([{ id: 1, name: 'Beta Home' }]);
    expect(alphaRepo.find).toHaveBeenCalledTimes(1);
    expect(betaRepo.find).toHaveBeenCalledTimes(1);
  });

  it('keeps the existing public store info contract', async () => {
    const response = await request(http)
      .get('/api/v1/store/info')
      .set('x-tenant-slug', 'beta')
      .expect(200);

    expect(response.body).toEqual({
      name: 'Beta Store',
      slug: 'beta',
      currency: 'eur',
    });
    expect(getRepository).not.toHaveBeenCalled();
  });

  it('requires a resolved, active tenant', async () => {
    await request(http).get('/api/v1/store/categories').expect(400);
    await request(http)
      .get('/api/v1/store/categories')
      .set('x-tenant-slug', 'unknown')
      .expect(404);

    alpha.status = TenantStatus.INACTIVE;
    await storefrontCategories('alpha').expect(403);

    expect(getRepository).not.toHaveBeenCalled();
  });

  it('keeps category management routes authenticated and permission-gated', async () => {
    await request(http)
      .get('/api/v1/categories')
      .set('x-tenant-slug', 'alpha')
      .expect(401);

    await request(http)
      .get('/api/v1/categories')
      .set('x-tenant-slug', 'alpha')
      .set('Authorization', 'Bearer token-alpha')
      .expect(403);

    expect(getRepository).not.toHaveBeenCalled();
  });

  it('rejects a tenant token used against another tenant', async () => {
    await request(http)
      .get('/api/v1/categories')
      .set('x-tenant-slug', 'alpha')
      .set('Authorization', 'Bearer token-beta')
      .expect(403);

    expect(usersService.findOne).not.toHaveBeenCalled();
    expect(getRepository).not.toHaveBeenCalled();
  });

  it('rejects an unverified user before permission checks', async () => {
    await request(http)
      .get('/api/v1/categories')
      .set('x-tenant-slug', 'alpha')
      .set('Authorization', 'Bearer token-unverified')
      .expect(403);

    expect(getRepository).not.toHaveBeenCalled();
  });
});
