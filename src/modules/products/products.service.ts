import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  PayloadTooLargeException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { Product } from './entities/product.entity';
import { ProductImage } from './entities/product-image.entity';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { TenantManagerService } from '../tenants/tenant-manager.service';
import { TenantService } from '../tenants/tenant.service';
import { tenantRefFromContext } from '../auth/tenant-context';
import { TenantRef } from '../tenants/tenant.utils';
import { R2Service } from '../../common/storage/r2.service';
import { IENV, IFiles, IDB } from '../../common/config/env.interface';
import { SerializedProduct } from './constants/products.interface';
import { ALLOWED_MIME_TYPES } from './constants/allowed-imgs-type';
import { MAX_FILES_PER_REQUEST } from './constants/upload.constants';
import { R2Upload } from '../../common/storage/interfaces/r2.interface';
import {
  CategoriesService,
  serializeCategory,
} from '../categories/categories.service';

@Injectable()
export class ProductsService {
  constructor(
    private readonly tenantManager: TenantManagerService,
    private readonly tenantService: TenantService,
    private readonly categoriesService: CategoriesService,
    private readonly r2: R2Service,
    private readonly config: ConfigService<IENV>,
  ) {}

  private resolveTenant(tenant?: TenantRef): TenantRef {
    const target = tenant ?? tenantRefFromContext();
    if (!target) throw new ForbiddenException('Tenant context required');
    return target;
  }

  private async repos(tenant?: TenantRef): Promise<{
    productRepo: Repository<Product>;
    imageRepo: Repository<ProductImage>;
  }> {
    const target = this.resolveTenant(tenant);
    const [productRepo, imageRepo] = await Promise.all([
      this.tenantManager.getRepository(Product, target),
      this.tenantManager.getRepository(ProductImage, target),
    ]);
    return { productRepo, imageRepo };
  }

  private serialize(product: Product): SerializedProduct {
    const { images, category, ...rest } = product;
    return {
      ...rest,
      category: category ? serializeCategory(category) : null,
      images: (images ?? [])
        .slice()
        .sort((a, b) => a.position - b.position)
        .map((image) => ({
          id: image.id,
          url: this.r2.publicUrl(image.objectKey),
          mimeType: image.mimeType,
          sizeBytes: image.sizeBytes,
          position: image.position,
        })),
    };
  }

  async create(dto: CreateProductDto, tenant?: TenantRef) {
    const { productRepo } = await this.repos(tenant);
    const target = this.resolveTenant(tenant);

    const existing = await productRepo.findOneBy({ sku: dto.sku });
    if (existing) throw new BadRequestException('sku already exists');

    if (dto.categoryId != null) {
      await this.assertCategory(dto.categoryId, target);
    }

    const product = await productRepo.save(
      productRepo.create({
        name: dto.name,
        sku: dto.sku,
        description: dto.description ?? null,
        price: dto.price,
        stock: dto.stock ?? 0,
        isActive: dto.isActive ?? true,
        categoryId: dto.categoryId ?? null,
      }),
    );
    return this.serialize(product);
  }

  async findAll(tenant?: TenantRef) {
    const { productRepo } = await this.repos(tenant);
    const products = await productRepo.find({
      relations: { images: true, category: true },
      order: { createdAt: 'DESC' },
    });
    return products.map((product) => this.serialize(product));
  }

  async findOne(id: number, tenant?: TenantRef) {
    const { productRepo } = await this.repos(tenant);
    const product = await productRepo.findOne({
      where: { id },
      relations: { images: true, category: true },
    });
    if (!product) throw new NotFoundException('Product not found');
    return this.serialize(product);
  }

  async update(id: number, dto: UpdateProductDto, tenant?: TenantRef) {
    const { productRepo } = await this.repos(tenant);
    const target = this.resolveTenant(tenant);
    const product = await productRepo.findOneBy({ id });
    if (!product) throw new NotFoundException('Product not found');

    if (dto.sku && dto.sku !== product.sku) {
      const existing = await productRepo.findOneBy({ sku: dto.sku });
      if (existing) throw new BadRequestException('sku already exists');
    }

    if (dto.categoryId != null) {
      await this.assertCategory(dto.categoryId, target);
    }

    await productRepo.update({ id }, { ...dto });
    return this.findOne(id, tenant);
  }

  async remove(id: number, tenant?: TenantRef) {
    const { productRepo, imageRepo } = await this.repos(tenant);
    const product = await productRepo.findOne({
      where: { id },
      relations: { images: true },
    });
    if (!product) throw new NotFoundException('Product not found');

    const keys = (product.images ?? []).map((image) => image.objectKey);
    if (keys.length > 0) {
      await imageRepo.delete({ productId: id });
      await this.r2.deleteMany(keys);
    }
    await productRepo.delete({ id });
    return { deleted: true };
  }

  async uploadImages(
    productId: number,
    files: Express.Multer.File[],
    tenant?: TenantRef,
  ) {
    const target = this.resolveTenant(tenant);
    const { productRepo, imageRepo } = await this.repos(target);

    const product = await productRepo.findOneBy({ id: productId });
    if (!product) throw new NotFoundException('Product not found');

    if (!files || files.length === 0) {
      throw new BadRequestException('At least one file is required');
    }
    if (files.length > MAX_FILES_PER_REQUEST) {
      throw new BadRequestException(
        `A maximum of ${MAX_FILES_PER_REQUEST} files can be uploaded per request`,
      );
    }

    const { maxFileSize, maxProductImages } =
      this.config.getOrThrow<IFiles>('files');

    for (const file of files) {
      if (file.size > maxFileSize) {
        throw new PayloadTooLargeException(
          `File ${file.originalname} exceeds the maximum size of ${maxFileSize} bytes`,
        );
      }
      if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
        throw new BadRequestException(
          `Unsupported image type: ${file.mimetype}. Allowed: ${[...ALLOWED_MIME_TYPES].join(', ')}`,
        );
      }
    }

    const count = await imageRepo.count({ where: { productId } });
    if (count + files.length > maxProductImages) {
      throw new BadRequestException(
        `Product can have a maximum of ${maxProductImages} images`,
      );
    }

    const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
    await this.assertQuota(totalBytes, target);

    const maxPosition = await imageRepo.maximum('position', { productId });
    const basePosition = maxPosition ?? 0;

    const uploaded: R2Upload[] = [];
    try {
      const results = await Promise.all(
        files.map(async (file) => {
          const result = await this.r2.upload(
            this.r2.buildObjectKey(
              target.schemaName,
              'products',
              file.originalname,
            ),
            file.buffer,
            file.mimetype,
          );
          uploaded.push(result);
          return result;
        }),
      );

      const entities = results.map((result, index) =>
        imageRepo.create({
          productId,
          objectKey: result.key,
          sizeBytes: result.sizeBytes,
          mimeType: files[index].mimetype,
          position: basePosition + index + 1,
        }),
      );
      await imageRepo.save(entities);
    } catch (error) {
      if (uploaded.length > 0) {
        await this.r2
          .deleteMany(uploaded.map((item) => item.key))
          .catch(() => undefined);
      }
      throw error;
    }

    return this.findOne(productId, target);
  }

  async deleteImage(productId: number, imageId: number, tenant?: TenantRef) {
    const { imageRepo } = await this.repos(tenant);
    const image = await imageRepo.findOneBy({ id: imageId, productId });
    if (!image) throw new NotFoundException('Image not found');

    await imageRepo.delete({ id: imageId });
    await this.r2.deleteMany([image.objectKey]);
    return this.findOne(productId, tenant);
  }

  async reorderImages(
    productId: number,
    imageIds: number[],
    tenant?: TenantRef,
  ) {
    const { productRepo, imageRepo } = await this.repos(tenant);
    const product = await productRepo.findOne({
      where: { id: productId },
      relations: { images: true },
    });
    if (!product) throw new NotFoundException('Product not found');

    const current = product.images ?? [];
    const currentIds = new Set(current.map((image) => image.id));
    if (
      imageIds.length !== currentIds.size ||
      !imageIds.every((id) => currentIds.has(id))
    ) {
      throw new BadRequestException(
        'imageIds must contain exactly the current image ids of the product',
      );
    }

    for (let position = 0; position < imageIds.length; position++) {
      await imageRepo.update({ id: imageIds[position] }, { position });
    }

    return this.findOne(productId, tenant);
  }

  private async assertCategory(
    categoryId: number,
    tenant: TenantRef,
  ): Promise<void> {
    const category = await this.categoriesService.findById(categoryId, tenant);
    if (!category) throw new BadRequestException('category not found');
  }

  private async assertQuota(
    incomingBytes: number,
    tenant: TenantRef,
  ): Promise<void> {
    const { tenantStorageCapacityBytes } = this.config.getOrThrow<IDB>('db');
    const record = await this.tenantService.findBySchemaName(tenant.schemaName);
    const capacity = record?.storageCapacityBytes ?? tenantStorageCapacityBytes;
    if (capacity <= 0) return;

    const { imageRepo } = await this.repos(tenant);
    const usedRaw = await imageRepo
      .createQueryBuilder('image')
      .select('COALESCE(SUM(image.sizeBytes), 0)', 'total')
      .getRawOne<{ total: string | null }>();
    const used = Number(usedRaw?.total ?? 0);

    if (used + incomingBytes > capacity) {
      throw new PayloadTooLargeException(
        'Upload exceeds tenant storage capacity',
      );
    }
  }
}
