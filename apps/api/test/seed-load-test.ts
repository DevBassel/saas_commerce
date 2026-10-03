import { NestFactory } from '@nestjs/core';
import { mkdir, writeFile } from 'fs/promises';
import { dirname, isAbsolute, resolve } from 'path';
import { AppModule } from '../src/app.module';
import { TenantService } from '../src/modules/tenants/tenant.service';
import { TenantProvisionerService } from '../src/modules/tenants/services/tenant-provisioner.service';
import { TenantManagerService } from '../src/modules/tenants/services/tenant-manager.service';
import { UsersService } from '../src/modules/users/users.service';
import { User } from '../src/modules/users/entities/user.entity';
import { Product } from '../src/modules/products/entities/product.entity';
import { Address } from '../src/modules/addresses/entities/address.entity';
import { RoleKey } from '../src/common/constants/RoleKey.enum';

const MIN_TENANTS = 10;
const REPO_ROOT = resolve(__dirname, '../../..');
const DEFAULT_TENANTS = Array.from(
  { length: MIN_TENANTS },
  (_, index) => `tenant-${index + 1}`,
);

interface SeedUser {
  email: string;
  tenantSlug: string;
}

interface SeedProduct {
  id: number;
  sku: string;
  price: number;
}

interface SeedTenant {
  slug: string;
  schemaName: string;
  ownerEmail: string;
  users: SeedUser[];
  products: SeedProduct[];
}

const assert = (cond: unknown, msg: string): void => {
  if (!cond) throw new Error(`SEED FAILED: ${msg}`);
};

const positiveInt = (
  raw: string | undefined,
  fallback: number,
  name: string,
) => {
  if (raw == null || raw === '') return fallback;
  const value = Number.parseInt(raw, 10);
  assert(Number.isInteger(value) && value >= 1, `${name} must be >= 1`);
  return value;
};

const parseTenants = (): string[] => {
  const raw = process.env.K6_TENANTS;
  if (!raw || !raw.trim()) return DEFAULT_TENANTS;

  const tenants = raw
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  if (tenants.length < MIN_TENANTS) {
    throw new Error(
      [
        'K6 requires at least 10 tenants.',
        `Configured tenants: ${tenants.length}`,
        `Minimum required: ${MIN_TENANTS}`,
      ].join('\n'),
    );
  }

  const duplicates = tenants.filter(
    (slug, index) => tenants.indexOf(slug) !== index,
  );
  assert(
    duplicates.length === 0,
    `K6_TENANTS contains duplicate slugs: ${[...new Set(duplicates)].join(', ')}`,
  );
  return tenants;
};

const resolveDataFile = (): string => {
  const raw = process.env.K6_DATA_FILE ?? 'load-tests/k6/data/dataset.json';
  return isAbsolute(raw) ? raw : resolve(REPO_ROOT, raw);
};

const ownerEmail = (slug: string): string => `owner+${slug}@k6.local`;
const userEmail = (slug: string, index: number): string =>
  `user${index}+${slug}@k6.local`;

async function ensureUser(
  users: UsersService,
  tenant: TenantRefLike,
  email: string,
  name: string,
  password: string,
  roleKey: RoleKey,
): Promise<User> {
  const existing = await users.findOne({ email }, {}, tenant);
  if (existing) return existing;
  return users.create({ name, email, password }, roleKey, tenant);
}

type TenantRefLike = { schemaName: string };

async function main(): Promise<void> {
  const tenantsConfig = parseTenants();
  const usersPerTenant = positiveInt(
    process.env.K6_USERS_PER_TENANT,
    20,
    'K6_USERS_PER_TENANT',
  );
  const productsPerTenant = positiveInt(
    process.env.K6_PRODUCTS_PER_TENANT,
    10,
    'K6_PRODUCTS_PER_TENANT',
  );
  const password = process.env.K6_PASSWORD ?? 'LoadTest1234';
  assert(
    password.length >= 8 && password.length <= 16,
    'K6_PASSWORD must be 8-16 characters (API DTO rule).',
  );

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  try {
    const tenantService = app.get(TenantService);
    const provisioner = app.get(TenantProvisionerService);
    const manager = app.get(TenantManagerService);
    const users = app.get(UsersService);

    const dataset: SeedTenant[] = [];

    for (const slug of tenantsConfig) {
      let tenant = await tenantService.findBySlug(slug);
      if (!tenant) {
        tenant = await tenantService.create({
          name: `K6 ${slug}`,
          slug,
        });
        console.log(`created tenant ${slug} (${tenant.schemaName})`);
      }
      await provisioner.provision(tenant);

      const tenantRef: TenantRefLike = { schemaName: tenant.schemaName };

      const owner = await ensureUser(
        users,
        tenantRef,
        ownerEmail(slug),
        `K6 ${slug} Owner`,
        password,
        RoleKey.STORE_OWNER,
      );
      if (tenant.ownerUserId !== owner.id) {
        await tenantService.setOwnerUserId(tenant.id, owner.id);
      }

      const userEntries: SeedUser[] = [];
      for (let index = 1; index <= usersPerTenant; index += 1) {
        const email = userEmail(slug, index);
        await ensureUser(
          users,
          tenantRef,
          email,
          `K6 ${slug} User ${index}`,
          password,
          RoleKey.CUSTOMER,
        );
        userEntries.push({ email, tenantSlug: slug });
      }

      const productRepo = await manager.getRepository(Product, tenantRef);
      const addressRepo = await manager.getRepository(Address, tenantRef);
      const userRepo = await manager.getRepository(User, tenantRef);

      const productEntries: SeedProduct[] = [];
      for (let index = 1; index <= productsPerTenant; index += 1) {
        const sku = `K6-${slug}-${index}`.toUpperCase();
        let product = await productRepo.findOneBy({ sku });
        if (!product) {
          product = await productRepo.save(
            productRepo.create({
              name: `K6 ${slug} Product ${index}`,
              sku,
              slug: `${slug}-k6-product-${index}`,
              description: `Load test product ${index} for ${slug}`,
              price: 10 + index,
              stock: 100000,
              isActive: true,
            }),
          );
        }
        productEntries.push({
          id: product.id,
          sku: product.sku,
          price: Number(product.price),
        });
      }

      const tenantUsers = await userRepo.find();
      for (const tenantUser of tenantUsers) {
        const existingAddress = await addressRepo.findOne({
          where: { userId: tenantUser.id, isDefault: true },
        });
        if (existingAddress) continue;
        await addressRepo.save(
          addressRepo.create({
            userId: tenantUser.id,
            recipientName: tenantUser.name,
            phone: '+10000000000',
            line1: `${indexLine(tenantUser.id)} K6 Street`,
            city: 'Loadville',
            state: 'CA',
            postalCode: '90001',
            country: 'US',
            label: 'K6 default',
            isDefault: true,
          }),
        );
      }

      dataset.push({
        slug,
        schemaName: tenant.schemaName,
        ownerEmail: ownerEmail(slug),
        users: userEntries,
        products: productEntries,
      });
      console.log(
        `seeded ${slug}: ${userEntries.length} users, ${productEntries.length} products`,
      );
    }

    assert(dataset.length >= MIN_TENANTS, `seeded ${dataset.length} tenants`);

    const payload = {
      generatedAt: new Date().toISOString(),
      baseUrl: process.env.K6_BASE_URL ?? 'http://localhost:4000/api/v1',
      password,
      usersPerTenant,
      productsPerTenant,
      tenants: dataset,
    };

    const dataFile = resolveDataFile();
    await mkdir(dirname(dataFile), { recursive: true });
    await writeFile(dataFile, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');

    console.log(`wrote dataset: ${dataFile}`);
    console.log('SEED LOAD TEST DATA: PASS');
  } finally {
    await app.close();
  }
}

const indexLine = (userId: number): number => (userId % 900) + 1;

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
