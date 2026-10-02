import { ConfigService } from '@nestjs/config';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  PayloadTooLargeException,
} from '@nestjs/common';
import { ProductsService } from './products.service';
import { Product } from './entities/product.entity';
import { TenantManagerService } from '../tenants/services/tenant-manager.service';
import { TenantService } from '../tenants/tenant.service';
import { CategoriesService } from '../categories/categories.service';
import { R2Service } from '../../common/storage/r2.service';
import { IENV, IFiles, IDB } from '../../common/config/env.interface';
import { MAX_FILES_PER_REQUEST } from './constants/upload.constants';

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
};

const buildMocks = () => {
  const productRepo = {
    findOneBy: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
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
  const tenantManager = {
    getRepository: jest.fn((entity: unknown) =>
      entity === Product
        ? Promise.resolve(productRepo)
        : Promise.resolve(imageRepo),
    ),
  } as unknown as TenantManagerService;
  const tenantService = {
    adjustStorageUsedBytes: jest.fn().mockResolvedValue(0),
    findBySchemaName: jest.fn().mockResolvedValue(null),
  };
  const categoriesService = {
    findById: jest.fn().mockResolvedValue({ id: 1 }),
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

  const service = new ProductsService(
    tenantManager,
    tenantService as unknown as TenantService,
    categoriesService,
    r2,
    config,
  );

  return {
    service,
    productRepo,
    imageRepo,
    tenantService,
    categoriesService,
    r2Mocks,
    r2,
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

describe('ProductsService', () => {
  it('requires a tenant context', async () => {
    const { service } = buildMocks();
    await expect(service.findAll()).rejects.toThrow(ForbiddenException);
    await expect(service.findOne(1)).rejects.toThrow(ForbiddenException);
  });

  it('creates a product and serializes empty images', async () => {
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
      { name: 'Shirt', sku: 'SHIRT-1', price: 9.99 },
      TENANT,
    );

    expect(result).toMatchObject({
      name: 'Shirt',
      sku: 'SHIRT-1',
      images: [],
    });
  });

  it('rejects a duplicate sku on create', async () => {
    const { service, productRepo } = buildMocks();
    productRepo.findOneBy.mockResolvedValue({ id: 1, sku: 'SHIRT-1' });

    await expect(
      service.create({ name: 'Shirt', sku: 'SHIRT-1', price: 9.99 }, TENANT),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects an unknown category on create', async () => {
    const { service, productRepo, categoriesService } = buildMocks();
    productRepo.findOneBy.mockResolvedValue(null);
    (categoriesService.findById as jest.Mock).mockResolvedValue(null);

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
