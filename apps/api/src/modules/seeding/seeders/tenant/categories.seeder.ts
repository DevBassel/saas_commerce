import { Injectable, Logger } from '@nestjs/common';
import { withUniqueRetry } from 'src/common/db/unique-retry';
import { Category } from 'src/modules/categories/entities/category.entity';
import { SeederOrder } from '../../constants/seeding.constants';
import {
  TenantSeeder,
  TenantSeederContext,
} from '../../interfaces/tenant-seeder.interface';

export const BASE_CATEGORIES: { name: string; slug: string }[] = [
  { name: 'Electronics', slug: 'electronics' },
  { name: 'Clothing', slug: 'clothing' },
  { name: 'Home & Kitchen', slug: 'home-kitchen' },
  { name: 'Beauty & Personal Care', slug: 'beauty-personal-care' },
  { name: 'Sports & Outdoors', slug: 'sports-outdoors' },
  { name: 'Toys & Games', slug: 'toys-games' },
  { name: 'Books', slug: 'books' },
  { name: 'Groceries', slug: 'groceries' },
];

/**
 * Opt-in: base categories are NOT part of the default provision/reseed
 * pipeline. Run explicitly with `seed --tenants --name categories`.
 */
@Injectable()
export class CategoriesSeeder implements TenantSeeder {
  readonly name = 'categories';
  readonly order = SeederOrder.CATEGORIES;
  readonly optIn = true;

  private readonly logger = new Logger(CategoriesSeeder.name);

  async run(context: TenantSeederContext): Promise<void> {
    const repo = context.dataSource.getRepository(Category);
    // Clone rows: TypeORM's upsert writes generated columns back into the passed
    // objects, which would corrupt the shared BASE_CATEGORIES constant and later
    // re-emit `id` as an update target (violating the products FK).
    await withUniqueRetry(() =>
      repo.upsert(
        BASE_CATEGORIES.map((category) => ({ ...category })),
        ['slug'],
      ),
    );
    this.logger.log(
      `Seeded ${BASE_CATEGORIES.length} base categories for ${context.tenant.slug}`,
    );
  }
}
