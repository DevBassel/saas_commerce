import { DataSource } from 'typeorm';
import { CategoriesSeeder, BASE_CATEGORIES } from './categories.seeder';
import { Category } from 'src/modules/categories/entities/category.entity';
import { Tenant } from 'src/modules/tenants/entities/tenant.entity';

describe('CategoriesSeeder', () => {
  it('is opt-in and upserts the base categories by slug', async () => {
    const upsert = jest.fn().mockResolvedValue(undefined);
    const dataSource = {
      getRepository: jest.fn((entity: unknown) => {
        expect(entity).toBe(Category);
        return { upsert };
      }),
    } as unknown as DataSource;
    const seeder = new CategoriesSeeder();

    await seeder.run({
      dataSource,
      manager: dataSource.manager,
      environment: 'development',
      tenant: { slug: 'acme' } as Tenant,
      schemaName: 'tenant_acme',
    });

    expect(seeder.name).toBe('categories');
    expect(seeder.optIn).toBe(true);
    expect(upsert).toHaveBeenCalledWith(
      BASE_CATEGORIES.map((category) => ({ ...category })),
      ['slug'],
    );
  });
});
