import { ConfigService } from '@nestjs/config';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  PayloadTooLargeException,
} from '@nestjs/common';
import {
  Between,
  ILike,
  LessThanOrEqual,
  MoreThan,
  MoreThanOrEqual,
} from 'typeorm';
import type { FindManyOptions } from 'typeorm';
import { ProductsService } from '../products.service';
import { Product } from '../entities/product.entity';
import { ProductImage } from '../entities/product-image.entity';
import { ListProductsQueryDto } from '../dto/list-products.query.dto';
import { TenantManagerService } from '../../tenants/services/tenant-manager.service';
import { TenantService } from '../../tenants/tenant.service';
import { Tenant } from '../../tenants/entities/tenant.entity';
import type { TenantRef } from '../../tenants/utils/tenant.utils';
import { tenantStorage } from '../../auth/tenant-context';
import { CategoriesService } from '../../categories/categories.service';
import { R2Service } from '../../../common/storage/r2.service';
import { IENV, IFiles, IDB } from '../../../common/config/env.interface';
import { MAX_FILES_PER_REQUEST } from '../constants/upload.constants';

const TENANT = { schemaName: 'tenant_test' };

const filesConfig: IFiles = {
  maxFileSize: 5 * 1024 * 1024,
  maxProductImages: 2,
};

const dbConfig: IDB = {
  name: 'saas_store',
  host: '127.0.0.1',
  port: 5432,
  username: 'postgres',
  password: 'root',
  synchronize: true,
  syncTenants: false,
  logging: false,
  ssl: false,
  tenantStorageCapacityBytes: 1000,
  tenantDbCapacityBytes: 1000,
  statementTimeoutMs: 30000,
};

const buildMocks = () => {
  const productRepo = {
    findOneBy: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn<Promise<unknown[]>, [FindManyOptions<Product>]>(),
    findAndCount: jest.fn<
      Promise<[unknown[], number]>,
      [FindManyOptions<Product>]
    >(),
    save: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };
  const imageRepo = {
    count: jest.fn(),
    findOneBy: jest.fn(),
    save: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    maximum: jest.fn(),
  };
  const getRepository = jest.fn<Promise<unknown>, [unknown, TenantRef]>(
    (entity) =>
      entity === Product
        ? Promise.resolve(productRepo)
        : Promise.resolve(imageRepo),
  );
  const tenantManager = { getRepository } as unknown as TenantManagerService;
  const tenantService = {
    adjustStorageUsedBytes: jest.fn().mockResolvedValue(0),
    findBySchemaName: jest.fn().mockResolvedValue(null),
  };
  const findById = jest.fn().mockResolvedValue({ id: 1 });
  const categoriesService = {
    findById,
  } as unknown as CategoriesService;
  const r2Mocks = {
    publicUrl: jest.fn((key: string) => `https://cdn.test/${key}`),
    buildObjectKey: jest.fn(
      (_schema: string, _folder: string, filename: string) =>
        `tenants/tenant_test/products/${filename}`,
    ),
    upload: jest.fn(),
    deleteMany: jest.fn(),
  };
  const r2 = r2Mocks as unknown as R2Service;
  const config = {
    getOrThrow: jest.fn((key: string) => {
      if (key === 'files') return filesConfig;
      if (key === 'db') return dbConfig;
      return undefined;
    }),
  } as unknown as ConfigService<IENV>;

  const cacheMocks = {
    invalidateProducts: jest.fn().mockResolvedValue(undefined),
    invalidateCategories: jest.fn().mockResolvedValue(undefined),
    invalidatePlans: jest.fn().mockResolvedValue(undefined),
  };

  const service = new ProductsService(
    tenantManager,
    tenantService as unknown as TenantService,
    categoriesService,
    r2,
    config,
    {
      assertCanCreateProduct: jest.fn().mockResolvedValue(undefined),
    } as never,
    cacheMocks as never,
  );

  return {
    service,
    productRepo,
    imageRepo,
    getRepository,
    tenantService,
    categoriesService,
    findById,
    r2Mocks,
    r2,
    cacheMocks,
  };
};

const file = (overrides: Partial<Express.Multer.File> = {}) =>
  ({
    buffer: Buffer.from('data'),
    mimetype: 'image/png',
    size: 4,
    originalname: 'photo.png',
    ...overrides,
  }) as Express.Multer.File;

const product = (overrides: Record<string, unknown> = {}) => ({
  id: 1,
  name: 'Shirt',
  sku: 'SKU-1',
  slug: 'shirt',
  description: null,
  price: 10,
  stock: 5,
  isActive: true,
  categoryId: null,
  category: null,
  images: [],
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  ...overrides,
});

describe('ProductsService', () => {
  it('requires a tenant context', async () => {
    const { service, getRepository } = buildMocks();
    await expect(service.findAll()).rejects.toThrow(ForbiddenException);
    await expect(
      service.findAll({ search: 'shirt', categoryId: 3, page: 1 }),
    ).rejects.toThrow(ForbiddenException);
    await expect(service.findOne(1)).rejects.toThrow(ForbiddenException);
    expect(getRepository).not.toHaveBeenCalled();
  });

  it('creates a product and serializes empty images', async () => {
    const { service, productRepo, cacheMocks } = buildMocks();
    productRepo.findOneBy.mockResolvedValue(null);
    productRepo.create.mockImplementation(
      (data: Record<string, unknown>) => data,
    );
    productRepo.save.mockImplementation((data: Record<string, unknown>) => ({
      id: 1,
      ...data,
    }));

    const result = await service.create(
      { name: 'Shirt', sku: 'SHIRT-1', price: 9.99 },
      TENANT,
    );

    expect(result).toMatchObject({
      name: 'Shirt',
      sku: 'SHIRT-1',
      images: [],
    });
    expect(cacheMocks.invalidateProducts).toHaveBeenCalledWith(TENANT);
  });

  it('rejects a duplicate sku on create', async () => {
    const { service, productRepo, cacheMocks } = buildMocks();
    productRepo.findOneBy.mockResolvedValue({ id: 1, sku: 'SHIRT-1' });

    await expect(
      service.create({ name: 'Shirt', sku: 'SHIRT-1', price: 9.99 }, TENANT),
    ).rejects.toThrow(BadRequestException);
    expect(cacheMocks.invalidateProducts).not.toHaveBeenCalled();
  });

  it('rejects an unknown category on create', async () => {
    const { service, productRepo, findById } = buildMocks();
    productRepo.findOneBy.mockResolvedValue(null);
    findById.mockResolvedValue(null);

    await expect(
      service.create(
        { name: 'Shirt', sku: 'SHIRT-1', price: 9.99, categoryId: 9 },
        TENANT,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws 404 when product missing', async () => {
    const { service, productRepo } = buildMocks();
    productRepo.findOne.mockResolvedValue(null);

    await expect(service.findOne(1, TENANT)).rejects.toThrow(NotFoundException);
  });

  it('rejects a duplicate sku on update', async () => {
    const { service, productRepo } = buildMocks();
    productRepo.findOneBy
      .mockResolvedValueOnce({ id: 1, sku: 'OLD' })
      .mockResolvedValueOnce({ id: 2, sku: 'TAKEN' });

    await expect(service.update(1, { sku: 'TAKEN' }, TENANT)).rejects.toThrow(
      BadRequestException,
    );
  });

  describe('findAll', () => {
    it('returns a legacy array when no pagination is requested', async () => {
      const { service, productRepo } = buildMocks();
      productRepo.find.mockResolvedValue([product()]);

      const result = await service.findAll({}, TENANT);

      expect(Array.isArray(result)).toBe(true);
      expect(productRepo.find).toHaveBeenCalledWith({
        where: {},
        relations: { images: true, category: true },
        order: { createdAt: 'DESC', id: 'DESC' },
      });
      expect(productRepo.findAndCount).not.toHaveBeenCalled();
    });

    it('preserves inactive and uncategorized products in the unfiltered array', async () => {
      const { service, productRepo } = buildMocks();
      const inactive = product({ isActive: false, stock: 0 });
      productRepo.find.mockResolvedValue([inactive]);

      await expect(service.findAll({}, TENANT)).resolves.toEqual([inactive]);
    });

    it('returns a paginated envelope when page/limit are sent', async () => {
      const { service, productRepo } = buildMocks();
      productRepo.findAndCount.mockResolvedValue([[product()], 1]);

      const result = await service.findAll({ page: 1, limit: 10 }, TENANT);

      expect(productRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          order: { createdAt: 'DESC', id: 'DESC' },
          skip: 0,
          take: 10,
          relationLoadStrategy: 'query',
        }),
      );
      expect(result).toMatchObject({ total: 1, page: 1, limit: 10 });
      expect((result as { data: unknown[] }).data).toHaveLength(1);
    });

    it('clamps the limit to 50 and computes skip from the page', async () => {
      const { service, productRepo } = buildMocks();
      productRepo.findAndCount.mockResolvedValue([[], 120]);

      const result = await service.findAll({ page: 3, limit: 100 }, TENANT);

      expect(productRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 100, take: 50 }),
      );
      expect(result).toMatchObject({ page: 3, limit: 50, total: 120 });
    });

    it.each([
      { query: { page: 2 }, page: 2, limit: 10, skip: 10 },
      { query: { limit: 12 }, page: 1, limit: 12, skip: 0 },
    ])('defaults the missing pagination value for $query', async (test) => {
      const { service, productRepo } = buildMocks();
      productRepo.findAndCount.mockResolvedValue([[], 0]);

      await expect(service.findAll(test.query, TENANT)).resolves.toEqual({
        data: [],
        total: 0,
        page: test.page,
        limit: test.limit,
      });
      expect(productRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ skip: test.skip, take: test.limit }),
      );
      expect(productRepo.find).not.toHaveBeenCalled();
    });

    it('keeps the filtered total on pages beyond the last result', async () => {
      const { service, productRepo } = buildMocks();
      productRepo.findAndCount.mockResolvedValue([[], 3]);

      await expect(
        service.findAll({ categoryId: 3, page: 5, limit: 2 }, TENANT),
      ).resolves.toEqual({ data: [], total: 3, page: 5, limit: 2 });
      expect(productRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ where: { categoryId: 3 }, skip: 8, take: 2 }),
      );
    });

    it('keeps the same unique tie-break order across page boundaries', async () => {
      const { service, productRepo } = buildMocks();
      productRepo.findAndCount
        .mockResolvedValueOnce([[product({ id: 3 }), product({ id: 2 })], 3])
        .mockResolvedValueOnce([[product({ id: 1 })], 3]);

      for (const page of [1, 2]) {
        await service.findAll(
          { page, limit: 2, sortBy: 'price', sortOrder: 'asc' },
          TENANT,
        );
        expect(productRepo.findAndCount).toHaveBeenNthCalledWith(
          page,
          expect.objectContaining({
            order: { price: 'ASC', id: 'DESC' },
            skip: (page - 1) * 2,
            take: 2,
          }),
        );
      }
    });

    it('honors a whitelisted sort and ignores unknown fields', async () => {
      const { service, productRepo } = buildMocks();
      productRepo.findAndCount.mockResolvedValue([[], 0]);

      await service.findAll(
        { page: 1, limit: 10, sortBy: 'price', sortOrder: 'asc' },
        TENANT,
      );
      expect(productRepo.findAndCount).toHaveBeenLastCalledWith(
        expect.objectContaining({ order: { price: 'ASC', id: 'DESC' } }),
      );

      await service.findAll(
        { page: 1, limit: 10, sortBy: 'drop table', sortOrder: 'desc' },
        TENANT,
      );
      expect(productRepo.findAndCount).toHaveBeenLastCalledWith(
        expect.objectContaining({ order: { createdAt: 'DESC', id: 'DESC' } }),
      );
    });
  });

  describe.each([false, true])(
    'findAll filters (paginated: %s)',
    (paginated) => {
      const run = async (
        query: ListProductsQueryDto,
        rows = [product()],
        total = rows.length,
      ) => {
        const mocks = buildMocks();
        mocks.productRepo.find.mockResolvedValue(rows);
        mocks.productRepo.findAndCount.mockResolvedValue([rows, total]);
        const result = await mocks.service.findAll(
          paginated ? { ...query, page: 1, limit: 12 } : query,
          TENANT,
        );
        const calls = paginated
          ? mocks.productRepo.findAndCount.mock.calls
          : mocks.productRepo.find.mock.calls;
        const options = calls[0][0];
        return { ...mocks, result, options };
      };

      it('ANDs every shared filter with each case-insensitive search alternative', async () => {
        const { options } = await run({
          search: 'sHiRt',
          categoryId: 3,
          minPrice: 10,
          maxPrice: 20,
          inStock: true,
        });

        expect(options.where).toEqual([
          {
            categoryId: 3,
            price: Between(10, 20),
            stock: MoreThan(0),
            name: ILike('%sHiRt%'),
          },
          {
            categoryId: 3,
            price: Between(10, 20),
            stock: MoreThan(0),
            sku: ILike('%sHiRt%'),
          },
          {
            categoryId: 3,
            price: Between(10, 20),
            stock: MoreThan(0),
            slug: ILike('%sHiRt%'),
          },
          {
            categoryId: 3,
            price: Between(10, 20),
            stock: MoreThan(0),
            description: ILike('%sHiRt%'),
          },
        ]);
        expect(options.relations).toEqual({ images: true, category: true });
        if (paginated) {
          expect(options).toMatchObject({
            skip: 0,
            take: 12,
            relationLoadStrategy: 'query',
          });
        } else {
          expect(options.skip).toBeUndefined();
          expect(options.take).toBeUndefined();
        }
      });

      it('keeps LIKE wildcards, backslashes, and SQL-looking text literal', async () => {
        const { options } = await run({
          search: "50%_off\\sale' OR 1=1 --",
        });
        const pattern = ILike("%50\\%\\_off\\\\sale' OR 1=1 --%");

        expect(options.where).toEqual([
          { name: pattern },
          { sku: pattern },
          { slug: pattern },
          { description: pattern },
        ]);
      });

      it.each([
        { query: { minPrice: 0 }, expected: MoreThanOrEqual(0) },
        { query: { minPrice: 10.5 }, expected: MoreThanOrEqual(10.5) },
        { query: { maxPrice: 0 }, expected: LessThanOrEqual(0) },
        { query: { maxPrice: 20.5 }, expected: LessThanOrEqual(20.5) },
        { query: { minPrice: 10, maxPrice: 20 }, expected: Between(10, 20) },
        { query: { minPrice: 10, maxPrice: 10 }, expected: Between(10, 10) },
        { query: { minPrice: 0, maxPrice: 0 }, expected: Between(0, 0) },
      ])('uses inclusive price comparisons for $query', async (test) => {
        const { options } = await run(test.query);
        expect(options.where).toEqual({ price: test.expected });
      });

      it.each([
        { inStock: true, expected: MoreThan(0) },
        { inStock: false, expected: LessThanOrEqual(0) },
      ])(
        'filters inStock=$inStock independently of active status',
        async (test) => {
          const { options } = await run({ inStock: test.inStock });
          expect(options.where).toEqual({ stock: test.expected });
        },
      );

      it('returns an empty result for a missing tenant-local category without a category lookup', async () => {
        const { result, options, findById, getRepository } = await run(
          { categoryId: 999 },
          [],
        );

        expect(options.where).toEqual({ categoryId: 999 });
        expect(result).toEqual(
          paginated ? { data: [], total: 0, page: 1, limit: 12 } : [],
        );
        expect(findById).not.toHaveBeenCalled();
        expect(getRepository).toHaveBeenCalledWith(Product, TENANT);
        expect(getRepository).toHaveBeenCalledWith(ProductImage, TENANT);
      });

      it.each(['asc', 'desc'] as const)(
        'sorts filtered results %s with a deterministic secondary key',
        async (sortOrder) => {
          const { options } = await run({
            search: 'shirt',
            sortBy: 'price',
            sortOrder,
          });
          expect(options.order).toEqual({
            price: sortOrder === 'asc' ? 'ASC' : 'DESC',
            id: 'DESC',
          });
        },
      );

      it('preserves category/image serialization and counts products, not images', async () => {
        const category = {
          id: 3,
          name: 'Tops',
          slug: 'tops',
          description: null,
          isActive: true,
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
          updatedAt: new Date('2026-01-01T00:00:00.000Z'),
        };
        const source = product({
          categoryId: 3,
          category,
          images: [
            {
              id: 5,
              objectKey: 'second.png',
              mimeType: 'image/png',
              sizeBytes: 4,
              position: 2,
            },
            {
              id: 6,
              objectKey: 'first.png',
              mimeType: 'image/png',
              sizeBytes: 5,
              position: 1,
            },
          ],
        });
        const { result } = await run({ categoryId: 3 }, [source], 1);
        const serialized = {
          ...source,
          category,
          images: [
            {
              id: 6,
              url: 'https://cdn.test/first.png',
              mimeType: 'image/png',
              sizeBytes: 5,
              position: 1,
            },
            {
              id: 5,
              url: 'https://cdn.test/second.png',
              mimeType: 'image/png',
              sizeBytes: 4,
              position: 2,
            },
          ],
        };

        expect(result).toEqual(
          paginated
            ? { data: [serialized], total: 1, page: 1, limit: 12 }
            : [serialized],
        );
      });

      it('isolates concurrent ALS tenants with overlapping product/category IDs', async () => {
        const { service, getRepository, imageRepo } = buildMocks();
        const tenants = ['a', 'b'].map((slug, index) =>
          Object.assign(new Tenant(), {
            id: index + 1,
            schemaName: `tenant_${slug}`,
          }),
        );
        const repositories = tenants.map((tenant) => {
          const rows = [product({ name: tenant.schemaName, categoryId: 3 })];
          return {
            find: jest.fn().mockResolvedValue(rows),
            findAndCount: jest.fn().mockResolvedValue([rows, 1]),
          };
        });
        getRepository.mockImplementation(
          (entity, target) =>
            new Promise((resolve) => {
              setImmediate(() => {
                const index = tenants.findIndex(
                  (tenant) => tenant.schemaName === target.schemaName,
                );
                resolve(entity === Product ? repositories[index] : imageRepo);
              });
            }),
        );

        const results = await Promise.all(
          tenants.map((tenant) =>
            tenantStorage.run({ tenant, tenantSchema: tenant.schemaName }, () =>
              service.findAll(
                paginated ? { categoryId: 3, page: 1 } : { categoryId: 3 },
              ),
            ),
          ),
        );

        results.forEach((result, index) => {
          const rows = Array.isArray(result) ? result : result.data;
          expect(rows).toHaveLength(1);
          expect(rows[0]).toMatchObject({
            id: 1,
            categoryId: 3,
            name: tenants[index].schemaName,
          });
          expect(getRepository).toHaveBeenCalledWith(Product, {
            schemaName: tenants[index].schemaName,
          });
          expect(getRepository).toHaveBeenCalledWith(ProductImage, {
            schemaName: tenants[index].schemaName,
          });
        });
      });
    },
  );

  describe('uploadImages', () => {
    it('rejects unsupported mime types', async () => {
      const { service, productRepo } = buildMocks();
      productRepo.findOneBy.mockResolvedValue({ id: 1 });

      await expect(
        service.uploadImages(
          1,
          [file({ mimetype: 'application/pdf' })],
          TENANT,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects files above MAX_FILE_SIZE', async () => {
      const { service, productRepo } = buildMocks();
      productRepo.findOneBy.mockResolvedValue({ id: 1 });

      await expect(
        service.uploadImages(
          1,
          [file({ size: filesConfig.maxFileSize + 1 })],
          TENANT,
        ),
      ).rejects.toThrow(PayloadTooLargeException);
    });

    it('rejects an empty file list', async () => {
      const { service, productRepo } = buildMocks();
      productRepo.findOneBy.mockResolvedValue({ id: 1 });

      await expect(service.uploadImages(1, [], TENANT)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rejects more than MAX_FILES_PER_REQUEST files', async () => {
      const { service, productRepo, imageRepo } = buildMocks();
      productRepo.findOneBy.mockResolvedValue({ id: 1 });
      imageRepo.count.mockResolvedValue(0);

      const files = Array.from({ length: MAX_FILES_PER_REQUEST + 1 }, (_, i) =>
        file({ originalname: `photo-${i}.png` }),
      );

      await expect(service.uploadImages(1, files, TENANT)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rejects when the product already has MAX_PRODUCT_IMAGES', async () => {
      const { service, productRepo, imageRepo } = buildMocks();
      productRepo.findOneBy.mockResolvedValue({ id: 1 });
      imageRepo.count.mockResolvedValue(filesConfig.maxProductImages);

      await expect(service.uploadImages(1, [file()], TENANT)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rejects when tenant storage capacity is exceeded', async () => {
      const { service, productRepo, imageRepo, tenantService, r2Mocks } =
        buildMocks();
      productRepo.findOneBy.mockResolvedValue({ id: 1 });
      imageRepo.count.mockResolvedValue(0);
      imageRepo.maximum.mockResolvedValue(0);
      r2Mocks.upload.mockResolvedValue({
        key: 'tenants/tenant_test/products/photo.png',
        sizeBytes: 4,
      });
      r2Mocks.deleteMany.mockResolvedValue(undefined);
      imageRepo.create.mockImplementation(
        (data: Record<string, unknown>) => data,
      );
      imageRepo.save.mockResolvedValue({});
      tenantService.adjustStorageUsedBytes.mockRejectedValue(
        new BadRequestException('Storage capacity exceeded'),
      );

      await expect(service.uploadImages(1, [file()], TENANT)).rejects.toThrow(
        BadRequestException,
      );

      expect(r2Mocks.deleteMany).toHaveBeenCalledWith([
        'tenants/tenant_test/products/photo.png',
      ]);
    });

    it('rejects upload before touching R2 when the tenant quota would be exceeded', async () => {
      const { service, productRepo, imageRepo, tenantService, r2Mocks } =
        buildMocks();
      productRepo.findOneBy.mockResolvedValue({ id: 1 });
      imageRepo.count.mockResolvedValue(0);
      tenantService.findBySchemaName.mockResolvedValue({
        storageUsedBytes: 1000,
        storageCapacityBytes: 1000,
      });

      await expect(service.uploadImages(1, [file()], TENANT)).rejects.toThrow(
        BadRequestException,
      );

      expect(r2Mocks.upload).not.toHaveBeenCalled();
    });

    it('records uploaded bytes against the tenant quota', async () => {
      const { service, productRepo, imageRepo, tenantService, r2Mocks } =
        buildMocks();
      productRepo.findOneBy.mockResolvedValue({ id: 1 });
      imageRepo.count.mockResolvedValue(0);
      r2Mocks.upload.mockResolvedValue({
        key: 'tenants/tenant_test/products/uuid.png',
        sizeBytes: 4,
      });
      imageRepo.create.mockImplementation(
        (data: Record<string, unknown>) => data,
      );
      imageRepo.save.mockResolvedValue({});
      imageRepo.maximum.mockResolvedValue(1);
      productRepo.findOne.mockResolvedValue({
        id: 1,
        name: 'Shirt',
        images: [
          {
            id: 5,
            objectKey: 'tenants/tenant_test/products/uuid.png',
            mimeType: 'image/png',
            sizeBytes: 4,
            position: 2,
          },
        ],
      });

      const result = await service.uploadImages(1, [file()], TENANT);

      expect(tenantService.adjustStorageUsedBytes).toHaveBeenCalledWith(
        'tenant_test',
        4,
      );
      expect(r2Mocks.upload).toHaveBeenCalledWith(
        'tenants/tenant_test/products/photo.png',
        expect.any(Buffer),
        'image/png',
      );
      expect(imageRepo.save).toHaveBeenCalledWith([
        expect.objectContaining({ productId: 1, position: 2, sizeBytes: 4 }),
      ]);
      expect(result.images[0]).toMatchObject({
        id: 5,
        url: 'https://cdn.test/tenants/tenant_test/products/uuid.png',
        position: 2,
      });
    });

    it('uploads multiple files with sequential positions', async () => {
      const { service, productRepo, imageRepo, r2Mocks, tenantService } =
        buildMocks();
      productRepo.findOneBy.mockResolvedValue({ id: 1 });
      imageRepo.count.mockResolvedValue(0);
      r2Mocks.upload.mockImplementation((key: string) =>
        Promise.resolve({ key, sizeBytes: 4 }),
      );
      imageRepo.create.mockImplementation(
        (data: Record<string, unknown>) => data,
      );
      imageRepo.save.mockResolvedValue({});
      imageRepo.maximum.mockResolvedValue(1);
      productRepo.findOne.mockResolvedValue({ id: 1, images: [] });

      await service.uploadImages(
        1,
        [file({ originalname: 'a.png' }), file({ originalname: 'b.png' })],
        TENANT,
      );

      expect(r2Mocks.upload).toHaveBeenCalledTimes(2);
      expect(imageRepo.save).toHaveBeenCalledWith([
        expect.objectContaining({
          objectKey: 'tenants/tenant_test/products/a.png',
          position: 2,
        }),
        expect.objectContaining({
          objectKey: 'tenants/tenant_test/products/b.png',
          position: 3,
        }),
      ]);
      expect(tenantService.adjustStorageUsedBytes).toHaveBeenCalledWith(
        'tenant_test',
        8,
      );
    });

    it('cleans up uploaded objects when a batch upload fails', async () => {
      const { service, productRepo, imageRepo, r2Mocks } = buildMocks();
      productRepo.findOneBy.mockResolvedValue({ id: 1 });
      imageRepo.count.mockResolvedValue(0);
      imageRepo.maximum.mockResolvedValue(0);
      r2Mocks.upload
        .mockImplementationOnce((key: string) =>
          Promise.resolve({ key, sizeBytes: 4 }),
        )
        .mockImplementationOnce(() => Promise.reject(new Error('boom')));
      r2Mocks.deleteMany.mockResolvedValue(undefined);

      await expect(
        service.uploadImages(
          1,
          [file({ originalname: 'a.png' }), file({ originalname: 'b.png' })],
          TENANT,
        ),
      ).rejects.toThrow('boom');

      expect(r2Mocks.deleteMany).toHaveBeenCalledWith([
        'tenants/tenant_test/products/a.png',
      ]);
    });
  });

  it('removes a product, its image rows, and R2 objects', async () => {
    const { service, productRepo, imageRepo, r2Mocks } = buildMocks();
    productRepo.findOne.mockResolvedValue({
      id: 1,
      images: [
        { id: 5, objectKey: 'k1', position: 1 },
        { id: 6, objectKey: 'k2', position: 2 },
      ],
    });

    await service.remove(1, TENANT);

    expect(imageRepo.delete).toHaveBeenCalledWith({ productId: 1 });
    expect(r2Mocks.deleteMany).toHaveBeenCalledWith(['k1', 'k2']);
    expect(productRepo.delete).toHaveBeenCalledWith({ id: 1 });
  });

  it('deletes a single image and its R2 object', async () => {
    const { service, imageRepo, r2Mocks, productRepo } = buildMocks();
    imageRepo.findOneBy.mockResolvedValue({ id: 5, objectKey: 'k1' });
    productRepo.findOne.mockResolvedValue({ id: 1, images: [] });

    await service.deleteImage(1, 5, TENANT);

    expect(imageRepo.delete).toHaveBeenCalledWith({ id: 5 });
    expect(r2Mocks.deleteMany).toHaveBeenCalledWith(['k1']);
  });

  it('releases deleted image bytes from the tenant quota', async () => {
    const { service, imageRepo, productRepo, tenantService } = buildMocks();
    imageRepo.findOneBy.mockResolvedValue({
      id: 5,
      objectKey: 'k1',
      sizeBytes: 4,
    });
    productRepo.findOne.mockResolvedValue({ id: 1, images: [] });

    await service.deleteImage(1, 5, TENANT);

    expect(tenantService.adjustStorageUsedBytes).toHaveBeenCalledWith(
      'tenant_test',
      -4,
    );
  });

  it('rejects reorder when imageIds do not match current images', async () => {
    const { service, productRepo } = buildMocks();
    productRepo.findOne.mockResolvedValue({
      id: 1,
      images: [
        { id: 5, position: 1 },
        { id: 6, position: 2 },
      ],
    });

    await expect(service.reorderImages(1, [5], TENANT)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('reorders images by array index', async () => {
    const { service, productRepo, imageRepo } = buildMocks();
    productRepo.findOne.mockResolvedValue({
      id: 1,
      images: [
        { id: 5, position: 1 },
        { id: 6, position: 2 },
      ],
    });
    productRepo.findOne.mockResolvedValueOnce({
      id: 1,
      images: [
        { id: 5, position: 1 },
        { id: 6, position: 2 },
      ],
    });
    productRepo.findOne.mockResolvedValueOnce({
      id: 1,
      images: [
        { id: 6, position: 0 },
        { id: 5, position: 1 },
      ],
    });

    const result = await service.reorderImages(1, [6, 5], TENANT);

    expect(imageRepo.update).toHaveBeenCalledWith({ id: 6 }, { position: 0 });
    expect(imageRepo.update).toHaveBeenCalledWith({ id: 5 }, { position: 1 });
    expect(result.images.map((image) => image.id)).toEqual([6, 5]);
  });

  it('dedupes the product slug on create with a numeric suffix', async () => {
    const { service, productRepo } = buildMocks();
    productRepo.findOneBy.mockImplementation(
      (where: Record<string, unknown>) => {
        if ('sku' in where) return Promise.resolve(null);
        if (where.slug === 'shirt') return Promise.resolve({ id: 9 });
        return Promise.resolve(null);
      },
    );
    productRepo.create.mockImplementation(
      (data: Record<string, unknown>) => data,
    );
    productRepo.save.mockImplementation((data: Record<string, unknown>) => ({
      id: 1,
      ...data,
    }));

    const result = await service.create(
      { name: 'Shirt', sku: 'SHIRT-1', price: 9.99 },
      TENANT,
    );

    expect(result.slug).toBe('shirt-2');
  });

  it('falls back to a seeded slug when the name has no alphanumerics', async () => {
    const { service, productRepo } = buildMocks();
    productRepo.findOneBy.mockResolvedValue(null);
    productRepo.create.mockImplementation(
      (data: Record<string, unknown>) => data,
    );
    productRepo.save.mockImplementation((data: Record<string, unknown>) => ({
      id: 1,
      ...data,
    }));

    const result = await service.create(
      { name: '!!!', sku: 'SKU-9', price: 1 },
      TENANT,
    );

    expect(result.slug).toBe('product-sku-9');
  });

  it('throws 404 when updating a missing product', async () => {
    const { service, productRepo } = buildMocks();
    productRepo.findOneBy.mockResolvedValue(null);

    await expect(service.update(1, { name: 'X' }, TENANT)).rejects.toThrow(
      NotFoundException,
    );
    expect(productRepo.update).not.toHaveBeenCalled();
  });

  it('backfills a slug when the stored product has none', async () => {
    const { service, productRepo } = buildMocks();
    productRepo.findOneBy
      .mockResolvedValueOnce({ id: 1, name: 'Shirt', sku: 'S', slug: null })
      .mockResolvedValueOnce(null);
    productRepo.update.mockResolvedValue(undefined);
    productRepo.findOne.mockResolvedValue({
      id: 1,
      name: 'Shirt',
      slug: 'shirt',
      images: [],
    });

    await service.update(1, { price: 5 }, TENANT);

    expect(productRepo.update).toHaveBeenCalledWith(
      { id: 1 },
      expect.objectContaining({ slug: 'shirt' }),
    );
  });

  it('re-slugifies when the name changes and the base slug is free', async () => {
    const { service, productRepo } = buildMocks();
    productRepo.findOneBy
      .mockResolvedValueOnce({ id: 1, name: 'Old', sku: 'S', slug: 'old' })
      .mockResolvedValueOnce(null);
    productRepo.update.mockResolvedValue(undefined);
    productRepo.findOne.mockResolvedValue({
      id: 1,
      name: 'New',
      slug: 'new',
      images: [],
    });

    await service.update(1, { name: 'New' }, TENANT);

    expect(productRepo.update).toHaveBeenCalledWith(
      { id: 1 },
      expect.objectContaining({ slug: 'new' }),
    );
  });

  it('keeps the base slug when it is owned by the same product', async () => {
    const { service, productRepo } = buildMocks();
    productRepo.findOneBy
      .mockResolvedValueOnce({ id: 1, name: 'Old', sku: 'S', slug: 'new' })
      .mockResolvedValueOnce({ id: 1 });
    productRepo.update.mockResolvedValue(undefined);
    productRepo.findOne.mockResolvedValue({
      id: 1,
      name: 'New',
      slug: 'new',
      images: [],
    });

    await service.update(1, { name: 'New' }, TENANT);

    expect(productRepo.update).toHaveBeenCalledWith(
      { id: 1 },
      expect.objectContaining({ slug: 'new' }),
    );
  });

  it('leaves the slug untouched when the new base is owned by another product', async () => {
    const { service, productRepo } = buildMocks();
    productRepo.findOneBy
      .mockResolvedValueOnce({ id: 1, name: 'Old', sku: 'S', slug: 'old' })
      .mockResolvedValueOnce({ id: 2 });
    productRepo.update.mockResolvedValue(undefined);
    productRepo.findOne.mockResolvedValue({
      id: 1,
      name: 'Taken',
      slug: 'old',
      images: [],
    });

    await service.update(1, { name: 'Taken' }, TENANT);

    expect(productRepo.update).toHaveBeenCalledWith(
      { id: 1 },
      { name: 'Taken' },
    );
  });

  it('rolls back every uploaded object when persisting image rows fails', async () => {
    const { service, productRepo, imageRepo, r2Mocks } = buildMocks();
    productRepo.findOneBy.mockResolvedValue({ id: 1 });
    imageRepo.count.mockResolvedValue(0);
    imageRepo.maximum.mockResolvedValue(0);
    r2Mocks.upload.mockImplementation((key: string) =>
      Promise.resolve({ key, sizeBytes: 4 }),
    );
    r2Mocks.deleteMany.mockResolvedValue(undefined);
    imageRepo.create.mockImplementation(
      (data: Record<string, unknown>) => data,
    );
    const failure = new Error('db down');
    imageRepo.save.mockRejectedValue(failure);

    await expect(
      service.uploadImages(
        1,
        [file({ originalname: 'a.png' }), file({ originalname: 'b.png' })],
        TENANT,
      ),
    ).rejects.toBe(failure);

    expect(r2Mocks.deleteMany).toHaveBeenCalledWith([
      'tenants/tenant_test/products/a.png',
      'tenants/tenant_test/products/b.png',
    ]);
    expect(imageRepo.delete).not.toHaveBeenCalled();
  });

  it('removes saved image rows when quota accounting fails after upload', async () => {
    const { service, productRepo, imageRepo, tenantService, r2Mocks } =
      buildMocks();
    productRepo.findOneBy.mockResolvedValue({ id: 1 });
    imageRepo.count.mockResolvedValue(0);
    imageRepo.maximum.mockResolvedValue(0);
    r2Mocks.upload.mockImplementation((key: string) =>
      Promise.resolve({ key, sizeBytes: 4 }),
    );
    r2Mocks.deleteMany.mockResolvedValue(undefined);
    imageRepo.create.mockImplementation(
      (data: Record<string, unknown>) => data,
    );
    imageRepo.save.mockResolvedValue([{ id: 11 }, { id: 12 }]);
    imageRepo.delete.mockResolvedValue(undefined);
    tenantService.adjustStorageUsedBytes.mockRejectedValue(new Error('quota'));

    await expect(
      service.uploadImages(
        1,
        [file({ originalname: 'a.png' }), file({ originalname: 'b.png' })],
        TENANT,
      ),
    ).rejects.toThrow('quota');

    expect(r2Mocks.deleteMany).toHaveBeenCalledWith([
      'tenants/tenant_test/products/a.png',
      'tenants/tenant_test/products/b.png',
    ]);
    expect(imageRepo.delete).toHaveBeenCalled();
  });

  it('serializes the category and sorts images by position', async () => {
    const { service, productRepo } = buildMocks();
    productRepo.findOne.mockResolvedValue({
      id: 1,
      name: 'Shirt',
      slug: 'shirt',
      category: {
        id: 3,
        name: 'Tops',
        slug: 'tops',
        description: null,
        isActive: true,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      },
      images: [
        {
          id: 5,
          objectKey: 'k2',
          mimeType: 'image/png',
          sizeBytes: 4,
          position: 2,
        },
        {
          id: 6,
          objectKey: 'k1',
          mimeType: 'image/png',
          sizeBytes: 5,
          position: 1,
        },
      ],
    });

    const result = await service.findOne(1, TENANT);

    expect(result.category).toMatchObject({
      id: 3,
      name: 'Tops',
      slug: 'tops',
    });
    expect(result.images.map((image) => image.id)).toEqual([6, 5]);
  });

  it('serializes a missing category as null and defaults images to empty', async () => {
    const { service, productRepo } = buildMocks();
    productRepo.findOne.mockResolvedValue({ id: 1, name: 'Shirt' });

    const result = await service.findOne(1, TENANT);

    expect(result.category).toBeNull();
    expect(result.images).toEqual([]);
  });
});
