import { ConflictException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { hash } from 'bcrypt';
import { DataSource, EntityManager, QueryRunner } from 'typeorm';
import { RoleKey } from 'src/common/constants/RoleKey.enum';
import { IENV } from 'src/common/config/env.interface';
import { isUniqueViolation } from 'src/common/db/unique-retry';
import { R2Service } from 'src/common/storage/r2.service';
import { TenantCacheService } from 'src/common/cache/tenant-cache.service';
import { Address } from 'src/modules/addresses/entities/address.entity';
import { StoreProvisioningService } from 'src/modules/auth/store-provisioning.service';
import { Category } from 'src/modules/categories/entities/category.entity';
import { Subscription } from 'src/modules/payments/entities/subscription.entity';
import { Product } from 'src/modules/products/entities/product.entity';
import { ProductImage } from 'src/modules/products/entities/product-image.entity';
import { Role } from 'src/modules/rbac/entities/role.entity';
import { BillingInterval } from 'src/modules/subscriptions/constants/billing-interval.enum';
import { SubscriptionPlan } from 'src/modules/subscriptions/entities/subscription-plan.entity';
import { SubscriptionPlansService } from 'src/modules/subscriptions/services/subscription-plans.service';
import { SubscriptionService } from 'src/modules/subscriptions/services/subscription.service';
import { Tenant } from 'src/modules/tenants/entities/tenant.entity';
import { TenantStatus } from 'src/modules/tenants/enums/tenantStatus.enum';
import { TenantManagerService } from 'src/modules/tenants/services/tenant-manager.service';
import { TenantMigrationService } from 'src/modules/tenants/services/tenant-migration.service';
import { TenantService } from 'src/modules/tenants/tenant.service';
import { User } from 'src/modules/users/entities/user.entity';
import { assertTenantSchemaName } from 'src/database/data-source-options';
import { SeedingService } from '../seeding.service';
import {
  buildDemoImageManifest,
  DemoImageManifestEntry,
  renderDemoImage,
  validateDemoImageManifest,
} from './demo-image-manifest';
import { DemoSeedLogger, DemoSeedProgress } from './demo-seed.logger';
import { verifyDemoSeed } from './demo-seed.verification';
import {
  buildDemoSeedData,
  createDemoTenantIdentity,
  DEMO_CUSTOMER_PASSWORD,
  DEMO_IMAGES_PER_PRODUCT,
  DemoSeedData,
} from './demo-tenant.data';

const FREE_PLAN_SLUG = 'free';
const STARTER_PLAN_SLUG = 'starter';
const MAX_TENANT_CREATE_ATTEMPTS = 8;
const IMAGE_UPLOAD_BATCH_SIZE = 10;

export interface DemoTenantSeedOptions {
  force?: boolean;
  onProgress?: DemoSeedProgress;
}

export interface DemoTenantSeedResult {
  tenantId: number;
  tenantSlug: string;
  schemaName: string;
  subscriptionPlan: string;
  customers: number;
  addresses: number;
  categories: number;
  products: number;
  productImages: number;
  durationMs: number;
}

interface UploadedDemoImage extends DemoImageManifestEntry {
  objectKey: string;
  originalSizeBytes: number;
  storedSizeBytes: number;
  mimeType: string;
}

@Injectable()
export class DemoTenantSeedService {
  constructor(
    @InjectDataSource() private readonly publicDataSource: DataSource,
    private readonly config: ConfigService<IENV>,
    private readonly seeding: SeedingService,
    private readonly tenants: TenantService,
    private readonly tenantManager: TenantManagerService,
    private readonly tenantMigrations: TenantMigrationService,
    private readonly storeProvisioning: StoreProvisioningService,
    private readonly plans: SubscriptionPlansService,
    private readonly subscriptions: SubscriptionService,
    private readonly r2: R2Service,
    private readonly cache: TenantCacheService,
  ) {}

  async run(
    options: DemoTenantSeedOptions = {},
  ): Promise<DemoTenantSeedResult> {
    const startedAt = Date.now();
    const logger = new DemoSeedLogger(options.onProgress);
    const uploaded: UploadedDemoImage[] = [];
    let tenant: Tenant | undefined;
    let tenantDataSource: DataSource | undefined;
    let data: DemoSeedData | undefined;

    this.seeding.assertEnvironmentAllowed(Boolean(options.force));

    try {
      logger.log(1, 'Plans', 'validating Free and Starter...');
      const { free, starter } = await this.requirePlans();
      logger.log(1, 'Plans', 'done');

      logger.log(2, 'Tenant', 'resolving Demo tenant...');
      tenant = await this.withDemoSeedLock(async () => {
        const created = await this.provisionNewTenant();
        tenant = created;
        return created;
      });
      logger.log(
        2,
        'Tenant',
        `done (${tenant.slug}, ${tenant.schemaName}, ${tenant.status})`,
      );

      logger.log(3, 'Schema', 'running tenant migrations...');
      await this.tenantMigrations.migrate(tenant.schemaName);
      tenantDataSource = await this.tenantManager.getDataSource(tenant);
      await tenantDataSource.query('SELECT 1');
      await this.assignStarter(tenant, free, starter);
      logger.log(3, 'Schema', 'done');

      logger.log(4, 'Customers', 'generating 10 customers...');
      data = buildDemoSeedData(tenant.slug);
      logger.log(4, 'Customers', 'hashing passwords...');
      const passwordHash = await hash(
        DEMO_CUSTOMER_PASSWORD,
        this.config.getOrThrow<IENV['bcrypt']>('bcrypt').rounds,
      );

      await tenantDataSource.transaction(async (manager) => {
        logger.log(4, 'Customers', 'inserting 10 records...');
        await this.insertCustomers(manager, data!, passwordHash);
        logger.log(4, 'Customers', 'done (10 created)');

        logger.log(
          5,
          'Categories',
          `generating ${data!.categories.length} categories...`,
        );
        logger.log(5, 'Categories', 'inserting records...');
        const categoryIds = await this.insertCategories(manager, data!);
        logger.log(
          5,
          'Categories',
          `done (${data!.categories.length} created)`,
        );

        logger.log(
          6,
          'Products',
          `generating ${data!.products.length} products...`,
        );
        logger.log(6, 'Products', 'assigning categories...');
        logger.log(
          6,
          'Products',
          `inserting ${data!.products.length} products...`,
        );
        const productIds = await this.insertProducts(
          manager,
          data!,
          categoryIds,
        );
        logger.log(6, 'Products', `done (${data!.products.length} created)`);

        logger.log(7, 'Images', 'preparing unique product images...');
        const manifest = buildDemoImageManifest(data!.products);
        validateDemoImageManifest(manifest, data!.products);
        logger.log(7, 'Images', 'validating image sources...');
        await this.assertImageStorageReady();
        logger.log(7, 'Images', 'uploading images to storage...');
        await this.uploadImages(tenant!, manifest, uploaded);
        logger.log(7, 'Images', 'inserting image records...');
        await this.insertImages(manager, uploaded, productIds);
        logger.log(
          7,
          'Images',
          `done (${uploaded.length} images, ${data!.products.length} products)`,
        );
      });
      const storedBytes = uploaded.reduce(
        (total, image) => total + image.storedSizeBytes,
        0,
      );
      await this.tenants.adjustStorageUsedBytes(tenant.schemaName, storedBytes);
      await Promise.all([
        this.cache.invalidateCategories(tenant),
        this.cache.invalidateProducts(tenant),
      ]);

      logger.log(8, 'Verification', 'checking tenant isolation...');
      await this.verifyTenant(tenant, tenantDataSource, starter);
      logger.log(8, 'Verification', 'checking customers...');
      logger.log(8, 'Verification', 'checking categories...');
      logger.log(8, 'Verification', 'checking products...');
      logger.log(8, 'Verification', 'checking image uniqueness...');
      const report = await verifyDemoSeed(
        tenantDataSource,
        data,
        DEMO_CUSTOMER_PASSWORD,
      );
      if (
        !(await this.r2.objectsExist(uploaded.map((image) => image.objectKey)))
      ) {
        throw new Error('One or more demo image objects are missing from R2');
      }
      logger.log(8, 'Verification', 'done (all checks passed)');

      const result: DemoTenantSeedResult = {
        tenantId: tenant.id,
        tenantSlug: tenant.slug,
        schemaName: tenant.schemaName,
        subscriptionPlan: starter.name,
        customers: report.customers,
        addresses: report.addresses,
        categories: report.categories,
        products: report.products,
        productImages: report.productImages,
        durationMs: Date.now() - startedAt,
      };
      logger.summary(result);
      return result;
    } catch (error) {
      const cleanupErrors = await this.compensateFailure({
        tenant,
        uploaded,
      });
      logger.fail(error);
      if (cleanupErrors.length > 0) {
        throw new AggregateError(
          [error, ...cleanupErrors],
          'Demo tenant seed failed and compensation was incomplete',
        );
      }
      throw error;
    }
  }

  private async requirePlans(): Promise<{
    free: SubscriptionPlan;
    starter: SubscriptionPlan;
  }> {
    const [free, starter] = await Promise.all([
      this.plans.findBySlug(FREE_PLAN_SLUG),
      this.plans.findBySlug(STARTER_PLAN_SLUG),
    ]);
    if (!free) throw new Error('Free subscription plan is not seeded');
    if (!starter) throw new Error('Starter subscription plan is not seeded');
    for (const plan of [free, starter]) {
      if (!plan.active || !plan.isPublic) {
        throw new Error(
          `${plan.name} subscription plan must be active and public`,
        );
      }
    }
    return { free, starter };
  }

  private async provisionNewTenant(): Promise<Tenant> {
    const tenantRepo = this.publicDataSource.getRepository(Tenant);
    for (let attempt = 1; attempt <= MAX_TENANT_CREATE_ATTEMPTS; attempt += 1) {
      const identity = createDemoTenantIdentity();
      const slug = identity.slug;
      const existing = await tenantRepo.findOne({
        select: { id: true },
        where: [{ name: identity.name }, { slug }, { subdomain: slug }],
      });
      if (existing) continue;
      try {
        const result = await this.storeProvisioning.provision({
          name: `${identity.name} Owner`,
          email: `owner.${slug}@example.com`,
          password: DEMO_CUSTOMER_PASSWORD,
          storeName: identity.name,
          storeSlug: slug,
          subdomain: slug,
        });
        if (result.tenant.status !== TenantStatus.ACTIVE) {
          throw new Error(`Demo tenant ${slug} did not become active`);
        }
        return result.tenant;
      } catch (error) {
        if (this.isTenantSlugCollision(error)) {
          if (attempt === MAX_TENANT_CREATE_ATTEMPTS) throw error;
          continue;
        }
        const incomplete = await this.tenants.findBySlug(slug);
        if (incomplete && incomplete.status !== TenantStatus.ACTIVE) {
          try {
            await this.storeProvisioning.cleanup(incomplete.id);
          } catch (cleanupError) {
            throw new AggregateError(
              [error, cleanupError],
              `Demo tenant provisioning failed and cleanup was incomplete for ${slug}`,
            );
          }
        }
        throw error;
      }
    }
    throw new Error('Unable to create a unique demo tenant');
  }

  private async assignStarter(
    tenant: Tenant,
    free: SubscriptionPlan,
    starter: SubscriptionPlan,
  ): Promise<void> {
    await this.subscriptions.withTenantLock(tenant.id, async (manager) => {
      const existing = await manager.findOne(Subscription, {
        where: { tenantId: tenant.id },
      });
      if (!existing)
        throw new Error('Provisioned tenant subscription is missing');
      if (existing.planId === starter.id) return;
      if (existing.planId !== free.id) {
        throw new Error(
          `Tenant ${tenant.slug} already uses another plan; refusing to replace it`,
        );
      }
      await this.subscriptions.assignPlan(
        tenant.id,
        {
          planId: starter.id,
          billingInterval: BillingInterval.MONTHLY,
        },
        manager,
      );
    });
  }

  private async insertCustomers(
    manager: EntityManager,
    data: DemoSeedData,
    passwordHash: string,
  ): Promise<void> {
    const role = await manager.findOneBy(Role, { key: RoleKey.CUSTOMER });
    if (!role) throw new Error('Customer role is not seeded');

    const inserted = await manager
      .createQueryBuilder()
      .insert()
      .into(User)
      .values(
        data.customers.map((customer) => ({
          name: customer.name,
          email: customer.email,
          password: passwordHash,
          roleId: role.id,
          emailVerified: true,
        })),
      )
      .returning(['id', 'email'])
      .execute();
    const users = inserted.raw as Array<{ id: number; email: string }>;
    if (users.length !== data.customers.length) {
      throw new Error('Bulk customer insert returned an unexpected row count');
    }
    const userIds = new Map(users.map((user) => [user.email, Number(user.id)]));

    await manager
      .createQueryBuilder()
      .insert()
      .into(Address)
      .values(
        data.customers.map((customer) => ({
          userId: userIds.get(customer.email)!,
          recipientName: customer.name,
          phone: customer.phone,
          line1: customer.line1,
          line2: customer.line2,
          city: customer.city,
          state: customer.state,
          postalCode: customer.postalCode,
          country: customer.country,
          label: 'Home',
          isDefault: true,
        })),
      )
      .execute();
  }

  private async insertCategories(
    manager: EntityManager,
    data: DemoSeedData,
  ): Promise<Map<string, number>> {
    const inserted = await manager
      .createQueryBuilder()
      .insert()
      .into(Category)
      .values(data.categories)
      .returning(['id', 'slug'])
      .execute();
    const rows = inserted.raw as Array<{ id: number; slug: string }>;
    if (rows.length !== data.categories.length) {
      throw new Error('Bulk category insert returned an unexpected row count');
    }
    return new Map(rows.map((row) => [row.slug, Number(row.id)]));
  }

  private async insertProducts(
    manager: EntityManager,
    data: DemoSeedData,
    categoryIds: Map<string, number>,
  ): Promise<Map<string, number>> {
    const inserted = await manager
      .createQueryBuilder()
      .insert()
      .into(Product)
      .values(
        data.products.map((product) => ({
          name: product.name,
          sku: product.sku,
          slug: product.slug,
          description: product.description,
          price: product.price,
          stock: product.stock,
          isActive: product.isActive,
          categoryId: categoryIds.get(product.categorySlug)!,
        })),
      )
      .returning(['id', 'slug'])
      .execute();
    const rows = inserted.raw as Array<{ id: number; slug: string }>;
    if (rows.length !== data.products.length) {
      throw new Error('Bulk product insert returned an unexpected row count');
    }
    return new Map(rows.map((row) => [row.slug, Number(row.id)]));
  }

  private async assertImageStorageReady(): Promise<void> {
    const files = this.config.getOrThrow<IENV['files']>('files');
    if (files.maxProductImages < DEMO_IMAGES_PER_PRODUCT) {
      throw new Error(
        `MAX_PRODUCT_IMAGES must be at least ${DEMO_IMAGES_PER_PRODUCT}`,
      );
    }
    if (!(await this.r2.healthy())) {
      throw new Error('R2 storage is unavailable');
    }
  }

  private async uploadImages(
    tenant: Tenant,
    manifest: DemoImageManifestEntry[],
    uploaded: UploadedDemoImage[],
  ): Promise<void> {
    for (
      let offset = 0;
      offset < manifest.length;
      offset += IMAGE_UPLOAD_BATCH_SIZE
    ) {
      const batch = manifest.slice(offset, offset + IMAGE_UPLOAD_BATCH_SIZE);
      const rendered = await Promise.all(
        batch.map(async (image) => ({
          image,
          buffer: await renderDemoImage(image),
        })),
      );
      const settled = await Promise.allSettled(
        rendered.map(async ({ image, buffer }) => {
          const result = await this.r2.upload(
            this.r2.buildObjectKey(
              tenant.schemaName,
              'products',
              `${image.productSlug}-${image.position}.png`,
            ),
            buffer,
            'image/png',
          );
          return {
            ...image,
            objectKey: result.key,
            originalSizeBytes: buffer.length,
            storedSizeBytes: result.sizeBytes,
            mimeType: 'image/webp',
          };
        }),
      );
      uploaded.push(
        ...settled.flatMap((result) =>
          result.status === 'fulfilled' ? [result.value] : [],
        ),
      );
      const failed = settled.find((result) => result.status === 'rejected');
      if (failed?.status === 'rejected') throw failed.reason;
    }

    const keys = uploaded.map((image) => image.objectKey);
    if (new Set(keys).size !== manifest.length) {
      throw new Error('R2 returned duplicate demo image object keys');
    }
  }

  private async insertImages(
    manager: EntityManager,
    images: UploadedDemoImage[],
    productIds: Map<string, number>,
  ): Promise<void> {
    await manager
      .createQueryBuilder()
      .insert()
      .into(ProductImage)
      .values(
        images.map((image) => ({
          productId: productIds.get(image.productSlug)!,
          objectKey: image.objectKey,
          originalSizeBytes: image.originalSizeBytes,
          storedSizeBytes: image.storedSizeBytes,
          mimeType: image.mimeType,
          position: image.position,
        })),
      )
      .execute();
  }

  private async verifyTenant(
    tenant: Tenant,
    tenantDataSource: DataSource,
    starter: SubscriptionPlan,
  ): Promise<void> {
    const registered = await this.tenants.findBySlug(tenant.slug);
    if (
      !registered ||
      registered.id !== tenant.id ||
      registered.schemaName !== tenant.schemaName ||
      registered.status !== TenantStatus.ACTIVE
    ) {
      throw new Error('Demo tenant registry verification failed');
    }
    if (
      (tenantDataSource.options as { schema?: string }).schema !==
      tenant.schemaName
    ) {
      throw new Error(
        'Demo data source is not scoped to the new tenant schema',
      );
    }
    const subscription = await this.subscriptions.getByTenantId(tenant.id);
    if (!subscription || subscription.planId !== starter.id) {
      throw new Error('Demo tenant Starter subscription verification failed');
    }
  }

  private async compensateFailure(state: {
    tenant?: Tenant;
    uploaded: UploadedDemoImage[];
  }): Promise<unknown[]> {
    const errors: unknown[] = [];
    let tenantDeleted = state.tenant == null;
    if (state.tenant) {
      try {
        await this.cleanupDemoTenant(state.tenant);
        tenantDeleted = true;
      } catch (error) {
        errors.push(error);
      }
    }

    if (tenantDeleted && state.uploaded.length > 0) {
      try {
        await this.r2.deleteMany(
          state.uploaded.map((image) => image.objectKey),
        );
      } catch (error) {
        errors.push(error);
      }
    }
    return errors;
  }

  private async cleanupDemoTenant(tenant: Tenant): Promise<void> {
    const schemaName = assertTenantSchemaName(tenant.schemaName);
    await this.tenantManager.release(tenant);
    const runner = this.publicDataSource.createQueryRunner();
    try {
      await runner.connect();
      await runner.startTransaction();
      const registered = await runner.manager.findOne(Tenant, {
        where: { id: tenant.id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!registered) {
        await runner.rollbackTransaction();
        return;
      }
      if (
        registered.slug !== tenant.slug ||
        registered.schemaName !== tenant.schemaName
      ) {
        throw new Error(
          'Refusing to clean up a tenant that this run did not create',
        );
      }
      await runner.query(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
      await runner.manager.delete(Tenant, { id: tenant.id });
      await runner.commitTransaction();
    } catch (error) {
      if (runner.isTransactionActive) await runner.rollbackTransaction();
      throw error;
    } finally {
      if (!runner.isReleased) await runner.release();
    }
  }

  private isTenantSlugCollision(error: unknown): boolean {
    if (isUniqueViolation(error)) return true;
    if (!(error instanceof ConflictException)) return false;
    const response = error.getResponse();
    const responseMessage =
      typeof response === 'string'
        ? response
        : (response as { message?: unknown }).message;
    const message =
      typeof responseMessage === 'string'
        ? responseMessage
        : Array.isArray(responseMessage)
          ? responseMessage.filter((item) => typeof item === 'string').join(' ')
          : '';
    return /already exists|does not match the existing provisioning request/i.test(
      message,
    );
  }

  private async withDemoSeedLock<T>(operation: () => Promise<T>): Promise<T> {
    const runner = this.publicDataSource.createQueryRunner();
    const lockName = 'saas-commerce:demo-tenant-seed';
    let locked = false;
    try {
      await runner.connect();
      await runner.query('SELECT pg_advisory_lock(hashtextextended($1, 0))', [
        lockName,
      ]);
      locked = true;
      return await operation();
    } finally {
      await this.releaseLock(runner, lockName, locked);
    }
  }

  private async releaseLock(
    runner: QueryRunner,
    lockName: string,
    locked: boolean,
  ): Promise<void> {
    const errors: unknown[] = [];
    if (locked) {
      try {
        await runner.query(
          'SELECT pg_advisory_unlock(hashtextextended($1, 0))',
          [lockName],
        );
      } catch (error) {
        errors.push(error);
      }
    }
    try {
      if (!runner.isReleased) await runner.release();
    } catch (error) {
      errors.push(error);
    }
    if (errors.length > 0) {
      throw new AggregateError(errors, 'Demo tenant seed lock cleanup failed');
    }
  }
}
