import sharp from 'sharp';
import {
  DEMO_CATEGORY_COUNT,
  DEMO_CUSTOMER_COUNT,
  DEMO_IMAGES_PER_PRODUCT,
  DEMO_PRODUCT_COUNT,
  buildDemoSeedData,
} from '../demo-tenant/demo-tenant.data';
import {
  buildDemoImageManifest,
  renderDemoImage,
  validateDemoImageManifest,
} from '../demo-tenant/demo-image-manifest';

describe('demo tenant fixture data', () => {
  const data = buildDemoSeedData('demo_01');

  it('contains the required customer, category, and product counts', () => {
    expect(data.customers).toHaveLength(DEMO_CUSTOMER_COUNT);
    expect(data.categories).toHaveLength(DEMO_CATEGORY_COUNT);
    expect(data.products).toHaveLength(DEMO_PRODUCT_COUNT);
  });

  it('uses unique deterministic identifiers and valid relationships', () => {
    expect(new Set(data.customers.map((customer) => customer.email)).size).toBe(
      DEMO_CUSTOMER_COUNT,
    );
    expect(new Set(data.categories.map((category) => category.slug)).size).toBe(
      DEMO_CATEGORY_COUNT,
    );
    expect(new Set(data.products.map((product) => product.sku)).size).toBe(
      DEMO_PRODUCT_COUNT,
    );
    expect(new Set(data.products.map((product) => product.slug)).size).toBe(
      DEMO_PRODUCT_COUNT,
    );

    const categorySlugs = new Set(
      data.categories.map((category) => category.slug),
    );
    expect(
      data.products.every((product) => categorySlugs.has(product.categorySlug)),
    ).toBe(true);
  });

  it('builds four unique product-specific image sources per product', () => {
    const manifest = buildDemoImageManifest(data.products);
    expect(() =>
      validateDemoImageManifest(manifest, data.products),
    ).not.toThrow();
    expect(manifest).toHaveLength(DEMO_PRODUCT_COUNT * DEMO_IMAGES_PER_PRODUCT);
    expect(new Set(manifest.map((image) => image.sourceId)).size).toBe(
      manifest.length,
    );
  });

  it('renders valid and distinct PNG sources', async () => {
    const manifest = buildDemoImageManifest(data.products);
    const samples = manifest.filter(
      (image) => image.productSlug === data.products[0].slug,
    );
    const buffers = await Promise.all(samples.map(renderDemoImage));
    const metadata = await Promise.all(
      buffers.map((buffer) => sharp(buffer).metadata()),
    );

    expect(
      new Set(buffers.map((buffer) => buffer.toString('base64'))).size,
    ).toBe(DEMO_IMAGES_PER_PRODUCT);
    expect(metadata.every((entry) => entry.format === 'png')).toBe(true);
  });
});
