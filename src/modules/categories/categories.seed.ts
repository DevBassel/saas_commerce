import { Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Category } from './entities/category.entity';

const logger = new Logger('CategorySeed');

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

export const seedCategories = async (ds: DataSource): Promise<void> => {
  const categoryRepo = ds.getRepository(Category);

  for (const seed of BASE_CATEGORIES) {
    const existing = await categoryRepo.findOneBy({ slug: seed.slug });
    if (existing) {
      existing.name = seed.name;
      await categoryRepo.save(existing);
      continue;
    }
    await categoryRepo.save(categoryRepo.create(seed));
  }

  logger.log(`Seeded ${BASE_CATEGORIES.length} base categories`);
};
