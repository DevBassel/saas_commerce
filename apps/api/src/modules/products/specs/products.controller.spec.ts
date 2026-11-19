import { ClassSerializerInterceptor, ValidationPipe } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import type { NextFunction, Request, Response } from 'express';
import { PinoLogger } from 'nestjs-pino';
import request from 'supertest';
import type { App } from 'supertest/types';
import { LessThanOrEqual } from 'typeorm';
import type { FindManyOptions } from 'typeorm';
import { CACHE_STORE } from '../../../common/cache/cache.types';
import type { CacheEntry, CacheStore } from '../../../common/cache/cache.types';
import { ResponseCacheInterceptor } from '../../../common/cache/response-cache.interceptor';
import { TenantCacheService } from '../../../common/cache/tenant-cache.service';
import type { ICache } from '../../../common/config/env.interface';
import { R2Service } from '../../../common/storage/r2.service';
import { TenantGuard } from '../../auth/guards/tenant.guard';
import { TenantMiddleware } from '../../auth/tenant.middleware';
import { CategoriesService } from '../../categories/categories.service';
import { Category } from '../../categories/entities/category.entity';
import { SubscriptionEntitlementsService } from '../../subscriptions/services/subscription-entitlements.service';
import { Tenant } from '../../tenants/entities/tenant.entity';
import { TenantStatus } from '../../tenants/enums/tenantStatus.enum';
import { TenantManagerService } from '../../tenants/services/tenant-manager.service';
import { TenantResolutionService } from '../../tenants/services/tenant-resolution.service';
import { TenantService } from '../../tenants/tenant.service';
import type { TenantRef } from '../../tenants/utils/tenant.utils';
import { ListProductsQueryDto } from '../dto/list-products.query.dto';
import { ProductImage } from '../entities/product-image.entity';
import { Product } from '../entities/product.entity';
import { ProductsController } from '../products.controller';
import { ProductsService } from '../products.service';

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

const product = (name = 'Shirt'): Product =>
  Object.assign(new Product(), {
    id: 1,
    name,
    sku: 'SHIRT-1',
    slug: 'shirt',
    description: null,
    price: 10,
    stock: 5,
    isActive: true,
    categoryId: 3,
    category: Object.assign(new Category(), {
      id: 3,
      name: 'Tops',
      slug: 'tops',
      isActive: true,
    }),
    images: [
      Object.assign(new ProductImage(), {
        id: 2,
        objectKey: 'second.png',
        mimeType: 'image/png',
        storedSizeBytes: 20,
        position: 2,
      }),
      Object.assign(new ProductImage(), {
        id: 1,
        objectKey: 'first.png',
        mimeType: 'image/png',
        storedSizeBytes: 10,
        position: 1,
      }),
    ],
  });

const createRepository = () => ({
  find: jest.fn<Promise<Product[]>, [FindManyOptions<Product>]>(),
  findAndCount: jest.fn<
    Promise<[Product[], number]>,
    [FindManyOptions<Product>]
  >(),
});

describe('ProductsController listing (Nest HTTP integration)', () => {
  let app: INestApplication;
  let http: App;
  let findAll: jest.SpyInstance;
  const alpha = Object.assign(new Tenant(), {
    id: 1,
    slug: 'alpha',
    schemaName: 'tenant_alpha',
    status: TenantStatus.ACTIVE,
  });
  const beta = Object.assign(new Tenant(), {
    id: 2,
    slug: 'beta',
    schemaName: 'tenant_beta',
    status: TenantStatus.ACTIVE,
  });
  const alphaRepo = createRepository();
  const betaRepo = createRepository();
  const getRepository = jest.fn((entity: unknown, tenant: TenantRef) => {
    if (entity === ProductImage) return Promise.resolve({});
    if (tenant.schemaName === alpha.schemaName)
      return Promise.resolve(alphaRepo);
    if (tenant.schemaName === beta.schemaName) return Promise.resolve(betaRepo);
    throw new Error('Unexpected tenant repository');
  });

  // Only persistence is replaced; requests use the real middleware, guard, pipe,
  // controller, service, response cache, and serializer.
  const entries = new Map<
    string,
    CacheEntry<unknown> & { namespace: string }
  >();
  const store: CacheStore = {
    get: <T>(key: string): Promise<CacheEntry<T> | null> =>
      Promise.resolve((entries.get(key) as CacheEntry<T> | undefined) ?? null),
    set: <T>(
      key: string,
      value: T,
      ttlMs: number,
      sizeBytes: number,
      namespace: string,
    ): Promise<boolean> => {
      entries.set(key, {
        value,
        sizeBytes,
        namespace,
      });
      return Promise.resolve(true);
    },
    invalidateNamespace: (namespace: string): Promise<number> => {
      let removed = 0;
      for (const [key, entry] of entries) {
        if (entry.namespace !== namespace) continue;
        entries.delete(key);
        removed += 1;
      }
      return Promise.resolve(removed);
    },
    getVersion: (): Promise<number> => Promise.resolve(0),
    pingRedis: (): Promise<boolean> => Promise.resolve(true),
  };

  const list = (query = '') =>
    request(http)
      .get(`/api/v1/products${query ? `?${query}` : ''}`)
      .set('x-tenant-slug', 'alpha');

  beforeAll(async () => {
    const tenants = [alpha, beta];
    const moduleRef = await Test.createTestingModule({
      controllers: [ProductsController],
      providers: [
        ProductsService,
        TenantResolutionService,
        TenantMiddleware,
        TenantGuard,
        TenantCacheService,
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
        { provide: CategoriesService, useValue: {} },
        { provide: SubscriptionEntitlementsService, useValue: {} },
        {
          provide: R2Service,
          useValue: { publicUrl: (key: string) => `https://cdn.test/${key}` },
        },
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: (key: string) => {
              if (key === 'cache') return CACHE;
              if (key === 'app') {
                return {
                  apiPrefix: 'api',
                  apiVersion: 'v1',
                  rootDomain: 'catalog.test',
                };
              }
              throw new Error(`Unexpected config group ${key}`);
            },
          },
        },
        { provide: CACHE_STORE, useValue: store },
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
    app.useGlobalGuards(app.get(TenantGuard));
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
    findAll = jest.spyOn(app.get(ProductsService), 'findAll');
    await app.init();
    http = app.getHttpServer() as App;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    entries.clear();
    alpha.status = TenantStatus.ACTIVE;
    beta.status = TenantStatus.ACTIVE;
    alphaRepo.find.mockResolvedValue([product()]);
    alphaRepo.findAndCount.mockResolvedValue([[product()], 1]);
    betaRepo.find.mockResolvedValue([product('Beta shirt')]);
    betaRepo.findAndCount.mockResolvedValue([[product('Beta shirt')], 1]);
  });

  afterAll(async () => {
    await app.close();
  });

  it('transforms all query fields and retains the clamped, serialized envelope', async () => {
    const response = await list(
      'search=%20Shirt%20&categoryId=3&minPrice=0&maxPrice=500.50&inStock=true&sortBy=price&sortOrder=ASC&page=2&limit=100',
    ).expect(200);

    expect(findAll).toHaveBeenCalledWith(
      expect.objectContaining({
        search: 'Shirt',
        categoryId: 3,
        minPrice: 0,
        maxPrice: 500.5,
        inStock: true,
        sortBy: 'price',
        sortOrder: 'asc',
        page: 2,
        limit: 100,
      }),
    );
    expect(findAll).toHaveBeenCalledWith(expect.any(ListProductsQueryDto));
    expect(alphaRepo.findAndCount).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 50, take: 50 }),
    );
    expect(response.body).toMatchObject({
      total: 1,
      page: 2,
      limit: 50,
      data: [
        {
          id: 1,
          category: { id: 3, name: 'Tops', slug: 'tops' },
          images: [
            {
              id: 1,
              url: 'https://cdn.test/first.png',
              mimeType: 'image/png',
              sizeBytes: 10,
              position: 1,
            },
            {
              id: 2,
              url: 'https://cdn.test/second.png',
              mimeType: 'image/png',
              sizeBytes: 20,
              position: 2,
            },
          ],
        },
      ],
    });
  });

  it.each(['', 'search=shirt&sortBy=price&sortOrder=desc'])(
    'keeps the array response without pagination (%s)',
    async (query) => {
      const response = await list(query).expect(200);
      expect(response.body).toEqual([expect.objectContaining({ id: 1 })]);
      expect(alphaRepo.find).toHaveBeenCalledTimes(1);
      expect(alphaRepo.findAndCount).not.toHaveBeenCalled();
    },
  );

  it('parses false as out of stock without hiding inactive products', async () => {
    alphaRepo.find.mockResolvedValue([
      Object.assign(product(), { stock: 0, isActive: false }),
    ]);

    const response = await list('inStock=false').expect(200);

    expect(alphaRepo.find).toHaveBeenCalledWith(
      expect.objectContaining({ where: { stock: LessThanOrEqual(0) } }),
    );
    expect(response.body).toEqual([
      expect.objectContaining({ stock: 0, isActive: false }),
    ]);
  });

  it.each([
    { query: 'page=2', page: 2, limit: 10 },
    { query: 'limit=12', page: 1, limit: 12 },
  ])('keeps pagination defaults for $query', async (test) => {
    const response = await list(test.query).expect(200);
    expect(response.body).toMatchObject({ page: test.page, limit: test.limit });
  });

  it.each([
    'search=',
    'search=%20%20',
    `search=${'x'.repeat(256)}`,
    'categoryId=0',
    'categoryId=1.5',
    'categoryId=0x10',
    'categoryId=2147483648',
    'minPrice=',
    'minPrice=-1',
    'minPrice=Infinity',
    'maxPrice=oops',
    'minPrice=20&maxPrice=10',
    'inStock=1',
    'inStock=TRUE',
    'sortBy=images',
    'sortBy=price%3BDROP%20TABLE%20products',
    'sortOrder=sideways',
    'page=0',
    'page=1.5',
    'page=Infinity',
    'limit=-1',
    'limit=',
    'tenant=beta',
    'tenantId=2',
    'tenantSchema=tenant_beta',
    'schemaName=tenant_beta',
    'isActive=true',
    'brand=test',
    'rating=5',
    'attributes=color',
    'search[value]=shirt',
    'minPrice[value]=1',
    'page[]=1',
    'inStock[]=true',
    'sortBy[]=price',
  ])(
    'rejects invalid HTTP query before repository access: %s',
    async (query) => {
      const response = await list(query).expect(400);
      const body = response.body as { statusCode: number; message: unknown };
      expect(body.statusCode).toBe(400);
      expect(Array.isArray(body.message)).toBe(true);
      expect(response.headers['x-cache']).toBe('BYPASS');
      expect(findAll).not.toHaveBeenCalled();
      expect(getRepository).not.toHaveBeenCalled();
    },
  );

  it.each([
    ['search', 'shirt'],
    ['categoryId', '3'],
    ['minPrice', '1'],
    ['maxPrice', '10'],
    ['inStock', 'true'],
    ['sortBy', 'price'],
    ['sortOrder', 'asc'],
    ['page', '1'],
    ['limit', '10'],
  ])('rejects repeated scalar parameter %s', async (field, value) => {
    await list(`${field}=${value}&${field}=${value}`).expect(400);
    expect(findAll).not.toHaveBeenCalled();
    expect(getRepository).not.toHaveBeenCalled();
  });

  it('requires a resolved, active tenant even for this public listing', async () => {
    await request(http).get('/api/v1/products').expect(400);
    await request(http)
      .get('/api/v1/products')
      .set('x-tenant-slug', 'unknown')
      .expect(404);
    alpha.status = TenantStatus.INACTIVE;
    await list().expect(403);
    expect(getRepository).not.toHaveBeenCalled();
  });

  it('resolves tenant subdomains through the existing middleware', async () => {
    const response = await request(http)
      .get('/api/v1/products?categoryId=3')
      .set('Host', 'beta.catalog.test')
      .expect(200);

    expect(response.body).toEqual([
      expect.objectContaining({ name: 'Beta shirt', categoryId: 3 }),
    ]);
    expect(getRepository).toHaveBeenCalledWith(Product, {
      schemaName: 'tenant_beta',
    });
    expect(alphaRepo.find).not.toHaveBeenCalled();
  });

  it('caches literal delimiter searches separately from sorted searches', async () => {
    alphaRepo.findAndCount
      .mockResolvedValueOnce([[product('Literal result')], 1])
      .mockResolvedValueOnce([[product('Sorted result')], 1]);
    const literal = 'search=shirt%26sortBy%3Dprice&page=1&limit=12';
    const sorted = 'search=shirt&sortBy=price&page=1&limit=12';

    for (const status of ['MISS', 'HIT']) {
      const literalResponse = await list(literal).expect(200);
      const sortedResponse = await list(sorted).expect(200);

      expect(literalResponse.headers['x-cache']).toBe(status);
      expect(sortedResponse.headers['x-cache']).toBe(status);
      expect(literalResponse.body).toMatchObject({
        data: [{ name: 'Literal result' }],
      });
      expect(sortedResponse.body).toMatchObject({
        data: [{ name: 'Sorted result' }],
      });
    }
    expect(alphaRepo.findAndCount).toHaveBeenCalledTimes(2);
  });

  it('cannot bypass scalar validation by hitting a cached string-shaped array', async () => {
    await list('search=%5Bshirt%5D').expect(200);

    await list('search[]=shirt').expect(400);
    expect(alphaRepo.find).toHaveBeenCalledTimes(1);
    expect(findAll).toHaveBeenCalledTimes(1);
  });

  it('separates cached tenant results and rechecks tenant status before a hit', async () => {
    const query = 'search=shirt&categoryId=3';

    for (const status of ['MISS', 'HIT']) {
      const a = await list(query).expect(200);
      const b = await request(http)
        .get(`/api/v1/products?${query}`)
        .set('x-tenant-slug', 'beta')
        .expect(200);

      expect(a.headers['x-cache']).toBe(status);
      expect(b.headers['x-cache']).toBe(status);
      expect(a.body).toEqual([
        expect.objectContaining({ id: 1, name: 'Shirt' }),
      ]);
      expect(b.body).toEqual([
        expect.objectContaining({ id: 1, name: 'Beta shirt' }),
      ]);
    }

    alpha.status = TenantStatus.INACTIVE;
    await list(query).expect(403);
    expect(alphaRepo.find).toHaveBeenCalledTimes(1);
    expect(betaRepo.find).toHaveBeenCalledTimes(1);
  });
});
