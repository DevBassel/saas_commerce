import type { Product } from '../entities/product.entity';

export const PRODUCT_SORTABLE_FIELDS = [
  'name',
  'sku',
  'slug',
  'price',
  'stock',
  'isActive',
  'categoryId',
  'createdAt',
  'updatedAt',
] as const satisfies readonly (keyof Product)[];
