import { compare } from 'bcrypt';
import { DataSource, In } from 'typeorm';
import { RoleKey } from 'src/common/constants/RoleKey.enum';
import { Address } from 'src/modules/addresses/entities/address.entity';
import { Category } from 'src/modules/categories/entities/category.entity';
import { Product } from 'src/modules/products/entities/product.entity';
import { ProductImage } from 'src/modules/products/entities/product-image.entity';
import { Role } from 'src/modules/rbac/entities/role.entity';
import { User } from 'src/modules/users/entities/user.entity';
import { DEMO_IMAGES_PER_PRODUCT, DemoSeedData } from './demo-tenant.data';

export interface DemoVerificationReport {
  customers: number;
  addresses: number;
  categories: number;
  products: number;
  productImages: number;
  passwordsValid: boolean;
  categoryRelationshipsValid: boolean;
  imageCountsValid: boolean;
  imageKeysUnique: boolean;
  duplicateSkus: number;
  duplicateSlugs: number;
}

interface ImageRelationshipRow {
  slug: string;
  categorySlug: string | null;
  categoryId: number | null;
  objectKey: string | null;
  position: number | null;
}

const duplicates = (values: string[]): number =>
  values.length - new Set(values).size;

export const verifyDemoSeed = async (
  dataSource: DataSource,
  data: DemoSeedData,
  password: string,
): Promise<DemoVerificationReport> => {
  const userRepo = dataSource.getRepository(User);
  const addressRepo = dataSource.getRepository(Address);
  const categoryRepo = dataSource.getRepository(Category);
  const productRepo = dataSource.getRepository(Product);
  const imageRepo = dataSource.getRepository(ProductImage);
  const roleRepo = dataSource.getRepository(Role);

  const customerRole = await roleRepo.findOneBy({ key: RoleKey.CUSTOMER });
  if (!customerRole)
    throw new Error('Customer role is missing during verification');

  const customerEmails = data.customers.map((customer) => customer.email);
  const categorySlugs = data.categories.map((category) => category.slug);
  const productSkus = data.products.map((product) => product.sku);
  const productSlugs = data.products.map((product) => product.slug);

  const [
    customers,
    addresses,
    categories,
    products,
    productImages,
    users,
    rows,
  ] = await Promise.all([
    userRepo.count({
      where: { email: In(customerEmails), roleId: customerRole.id },
    }),
    addressRepo
      .createQueryBuilder('address')
      .innerJoin(User, 'user', 'user.id = address.userId')
      .where('user.email IN (:...emails)', { emails: customerEmails })
      .getCount(),
    categoryRepo.count({ where: { slug: In(categorySlugs) } }),
    productRepo.count({ where: { sku: In(productSkus) } }),
    imageRepo
      .createQueryBuilder('image')
      .innerJoin(Product, 'product', 'product.id = image.productId')
      .where('product.sku IN (:...skus)', { skus: productSkus })
      .getCount(),
    userRepo.find({
      select: { id: true, email: true, password: true, emailVerified: true },
      where: { email: In(customerEmails), roleId: customerRole.id },
    }),
    productRepo
      .createQueryBuilder('product')
      .leftJoin(ProductImage, 'image', 'image.productId = product.id')
      .leftJoin(Category, 'category', 'category.id = product.categoryId')
      .select('product.slug', 'slug')
      .addSelect('product.categoryId', 'categoryId')
      .addSelect('category.slug', 'categorySlug')
      .addSelect('image.objectKey', 'objectKey')
      .addSelect('image.position', 'position')
      .where('product.sku IN (:...skus)', { skus: productSkus })
      .getRawMany<ImageRelationshipRow>(),
  ]);

  const passwordChecks = await Promise.all(
    users.map((user) => compare(password, user.password)),
  );
  const passwordsValid =
    users.length === data.customers.length &&
    users.every((user) => user.emailVerified) &&
    new Set(users.map((user) => user.password)).size === 1 &&
    passwordChecks.every(Boolean);

  const imageKeys = rows.flatMap((row) =>
    row.objectKey == null ? [] : [row.objectKey],
  );
  const imageCountsValid = productSlugs.every((slug) => {
    const positions = rows
      .filter((row) => row.slug === slug)
      .flatMap((row) => (row.position == null ? [] : [Number(row.position)]))
      .sort((a, b) => a - b);
    return (
      positions.length === DEMO_IMAGES_PER_PRODUCT &&
      positions.join(',') === '1,2,3,4'
    );
  });
  const expectedCategories = new Map(
    data.products.map((product) => [product.slug, product.categorySlug]),
  );

  const report: DemoVerificationReport = {
    customers,
    addresses,
    categories,
    products,
    productImages,
    passwordsValid,
    categoryRelationshipsValid: rows.every(
      (row) =>
        row.categoryId != null &&
        row.categorySlug === expectedCategories.get(row.slug),
    ),
    imageCountsValid,
    imageKeysUnique: new Set(imageKeys).size === imageKeys.length,
    duplicateSkus: duplicates(productSkus),
    duplicateSlugs: duplicates(productSlugs),
  };

  const expectedImages = data.products.length * DEMO_IMAGES_PER_PRODUCT;
  const valid =
    report.customers === data.customers.length &&
    report.addresses === data.customers.length &&
    report.categories === data.categories.length &&
    report.products === data.products.length &&
    report.productImages === expectedImages &&
    report.passwordsValid &&
    report.categoryRelationshipsValid &&
    report.imageCountsValid &&
    report.imageKeysUnique &&
    report.duplicateSkus === 0 &&
    report.duplicateSlugs === 0;
  if (!valid) {
    throw new Error(`Demo seed verification failed: ${JSON.stringify(report)}`);
  }

  return report;
};
