import { ConfigService } from '@nestjs/config';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  PayloadTooLargeException,
} from '@nestjs/common';
import { ProductsService } from './products.service';
import { Product } from './entities/product.entity';
import { TenantManagerService } from '../tenants/tenant-manager.service';
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
    createQueryBuilder: jest.fn(),
  };
  const tenantManager = {
    getRepository: jest.fn((entity: unknown) =>
      entity === Product
        ? Promise.resolve(productRepo)
        : Promise.resolve(imageRepo),
    ),
  } as unknown as TenantManagerService;
  const tenantService = {
    findBySchemaName: jest.fn(),
  } as unknown as TenantService;
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
    tenantService,
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
      const { service, productRepo, imageRepo, tenantService } = buildMocks();
      productRepo.findOneBy.mockResolvedValue({ id: 1 });
      imageRepo.count.mockResolvedValue(0);
      (tenantService.findBySchemaName as jest.Mock).mockResolvedValue(null);
      imageRepo.createQueryBuilder.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ total: '998' }),
      });

      await expect(service.uploadImages(1, [file()], TENANT)).rejects.toThrow(
        PayloadTooLargeException,
      );
    });

    it('honors per-tenant capacity override', async () => {
      const { service, productRepo, imageRepo, tenantService, r2Mocks } =
        buildMocks();
      productRepo.findOneBy.mockResolvedValue({ id: 1 });
      imageRepo.count.mockResolvedValue(0);
      (tenantService.findBySchemaName as jest.Mock).mockResolvedValue({
        storageCapacityBytes: 2000,
      });
      imageRepo.createQueryBuilder.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ total: '1500' }),
      });
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
      const { service, productRepo, imageRepo, r2Mocks } = buildMocks();
      productRepo.findOneBy.mockResolvedValue({ id: 1 });
      imageRepo.count.mockResolvedValue(0);
      imageRepo.createQueryBuilder.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ total: '0' }),
      });
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
    });

    it('cleans up uploaded objects when a batch upload fails', async () => {
      const { service, productRepo, imageRepo, r2Mocks } = buildMocks();
      productRepo.findOneBy.mockResolvedValue({ id: 1 });
      imageRepo.count.mockResolvedValue(0);
      imageRepo.createQueryBuilder.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ total: '0' }),
      });
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
});
