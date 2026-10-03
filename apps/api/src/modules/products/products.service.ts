import {
  BadRequestException,
  Injectable,
  NotFoundException,
  PayloadTooLargeException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { In, Repository } from 'typeorm';
import { Product } from './entities/product.entity';
import { ProductImage } from './entities/product-image.entity';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { TenantManagerService } from '../tenants/services/tenant-manager.service';
import { TenantService } from '../tenants/tenant.service';
import { TenantRef } from '../tenants/utils/tenant.utils';
import { resolveTenantScope } from '../tenants/utils/tenant-scope';
import { R2Service } from '../../common/storage/r2.service';
import { IENV, IFiles } from '../../common/config/env.interface';
import { SerializedProduct } from './constants/products.interface';
import {
  ensureUniqueProductSlug,
  slugifyProductName,
} from './utils/products.slug';
import { serializeProduct } from './utils/products.serializer';
import { ALLOWED_MIME_TYPES } from './constants/allowed-imgs-type';
import { MAX_FILES_PER_REQUEST } from './constants/upload.constants';
import { R2Upload } from '../../common/storage/interfaces/r2.interface';
import { CategoriesService } from '../categories/categories.service';
import {
  isPaginatedQuery,
  resolvePagination,
  resolveSort,
} from '../../common/pagination/pagination';
import { ListProductsQueryDto } from './dto/list-products.query.dto';
import { SubscriptionEntitlementsService } from '../subscriptions/services/subscription-entitlements.service';

const PRODUCT_SORTABLE_FIELDS: readonly (keyof Product)[] = [
  'name',
  'sku',
  'slug',
  'price',
  'stock',
  'isActive',
  'categoryId',
  'createdAt',
  'updatedAt',
];

@Injectable()
export class ProductsService {
  constructor(
    private readonly tenantManager: TenantManagerService,
    private readonly tenantService: TenantService,
    private readonly categoriesService: CategoriesService,
    private readonly r2: R2Service,
    private readonly config: ConfigService<IENV>,
    private readonly entitlements: SubscriptionEntitlementsService,
  ) {}

  private async repos(tenant?: TenantRef): Promise<{
    productRepo: Repository<Product>;
    imageRepo: Repository<ProductImage>;
  }> {
    const target = resolveTenantScope(tenant);
    const [productRepo, imageRepo] = await Promise.all([
      this.tenantManager.getRepository(Product, target),
      this.tenantManager.getRepository(ProductImage, target),
    ]);
    return { productRepo, imageRepo };
  }

  private serialize(product: Product): SerializedProduct {
    return serializeProduct(product, this.r2);
  }

  private uniqueSlug(
    productRepo: Repository<Product>,
    name: string,
    seed: string,
    excludeId?: number,
  ): Promise<string> {
    return ensureUniqueProductSlug(
      (candidate) => productRepo.findOneBy({ slug: candidate }),
      name,
      seed,
      excludeId,
    );
  }

  async create(dto: CreateProductDto, tenant?: TenantRef) {
    const { productRepo } = await this.repos(tenant);
    const target = resolveTenantScope(tenant);

    await this.entitlements.assertCanCreateProduct(target);

    const existing = await productRepo.findOneBy({ sku: dto.sku });
    if (existing) throw new BadRequestException('sku already exists');

    if (dto.categoryId != null) {
      await this.assertCategory(dto.categoryId, target);
    }

    const slug = await this.uniqueSlug(productRepo, dto.name, dto.sku);

    const product = await productRepo.save(
      productRepo.create({
        name: dto.name,
        sku: dto.sku,
        slug,
        description: dto.description ?? null,
        price: dto.price,
        stock: dto.stock ?? 0,
        isActive: dto.isActive ?? true,
        categoryId: dto.categoryId ?? null,
      }),
    );
    return this.serialize(product);
  }

  async findAll(query: ListProductsQueryDto = {}, tenant?: TenantRef) {
    const { productRepo } = await this.repos(tenant);
    const relations = { images: true, category: true };

    if (!isPaginatedQuery(query)) {
      const products = await productRepo.find({
        relations,
        order: { createdAt: 'DESC' },
      });
      return products.map((product) => this.serialize(product));
    }

    const { page, limit, skip, take } = resolvePagination(query);
    const order = resolveSort<Product>(
      query.sortBy,
      query.sortOrder,
      PRODUCT_SORTABLE_FIELDS,
      { field: 'createdAt', order: 'desc' },
    );

    const [products, total] = await productRepo.findAndCount({
      relations,
      order,
      skip,
      take,
      relationLoadStrategy: 'query',
    });
    return {
      data: products.map((product) => this.serialize(product)),
      total,
      page,
      limit,
    };
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
    const target = resolveTenantScope(tenant);
    const product = await productRepo.findOneBy({ id });
    if (!product) throw new NotFoundException('Product not found');

    if (dto.sku && dto.sku !== product.sku) {
      const existing = await productRepo.findOneBy({ sku: dto.sku });
      if (existing) throw new BadRequestException('sku already exists');
    }

    if (dto.categoryId != null) {
      await this.assertCategory(dto.categoryId, target);
    }

    const patch: UpdateProductDto & { slug?: string } = { ...dto };

    if (dto.name && dto.name !== product.name) {
      if (!product.slug) {
        patch.slug = await this.uniqueSlug(productRepo, dto.name, String(id));
      } else {
        const base = slugifyProductName(dto.name);
        const owner = base ? await productRepo.findOneBy({ slug: base }) : null;
        if (base && (!owner || owner.id === id)) patch.slug = base;
      }
    } else if (!product.slug) {
      patch.slug = await this.uniqueSlug(productRepo, product.name, String(id));
    }

    await productRepo.update({ id }, patch);
    return this.findOne(id, tenant);
  }

  async remove(id: number, tenant?: TenantRef) {
    const { productRepo, imageRepo } = await this.repos(tenant);
    const product = await productRepo.findOne({
      where: { id },
      relations: { images: true },
    });
    if (!product) throw new NotFoundException('Product not found');

    const keys = (product.images ?? []).map((image) => ({
      key: image.objectKey,
      size: image.sizeBytes,
    }));
    if (keys.length > 0) {
      await imageRepo.delete({ productId: id });
      await this.r2.deleteMany(keys.map((key) => key.key));
      const getTenant = resolveTenantScope(tenant);
      // update capacity
      await this.tenantService.adjustStorageUsedBytes(
        getTenant.schemaName,
        -keys.map((key) => key.size).reduce((a, b) => a + b, 0),
      );
    }
    await productRepo.delete({ id });
    return { deleted: true };
  }

  async uploadImages(
    productId: number,
    files: Express.Multer.File[],
    tenant?: TenantRef,
  ) {
    const target = resolveTenantScope(tenant);
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

    const registered = await this.tenantService.findBySchemaName(
      target.schemaName,
    );
    if (
      registered &&
      BigInt(registered.storageUsedBytes) + BigInt(totalBytes) >
        BigInt(registered.storageCapacityBytes)
    ) {
      throw new BadRequestException('Storage capacity exceeded');
    }

    const maxPosition = await imageRepo.maximum('position', { productId });
    const basePosition = maxPosition ?? 0;

    const uploaded: R2Upload[] = [];
    let savedEntities: ProductImage[] | null = null;
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
      savedEntities = await imageRepo.save(entities);
      // update capacity
      await this.tenantService.adjustStorageUsedBytes(
        target.schemaName,
        totalBytes,
      );
    } catch (error) {
      if (uploaded.length > 0) {
        await this.r2
          .deleteMany(uploaded.map((item) => item.key))
          .catch(() => undefined);
      }
      if (savedEntities?.length) {
        await imageRepo
          .delete({ id: In(savedEntities.map((entity) => entity.id)) })
          .catch(() => undefined);
      }
      throw error;
    }

    return this.findOne(productId, target);
  }

  async deleteImage(productId: number, imageId: number, tenant?: TenantRef) {
    const target = resolveTenantScope(tenant);
    const { imageRepo } = await this.repos(target);
    const image = await imageRepo.findOneBy({ id: imageId, productId });
    if (!image) throw new NotFoundException('Image not found');

    await imageRepo.delete({ id: imageId });
    await this.r2.deleteMany([image.objectKey]);

    // update capacity
    await this.tenantService.adjustStorageUsedBytes(
      target.schemaName,
      -image.sizeBytes,
    );

    return this.findOne(productId, target);
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
}
