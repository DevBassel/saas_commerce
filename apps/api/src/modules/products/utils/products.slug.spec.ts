import {
  buildProductSlugBase,
  ensureUniqueProductSlug,
  slugifyProductName,
  withSlugSuffix,
} from './products.slug';

describe('product slug helpers', () => {
  it('slugifies a product name', () => {
    expect(slugifyProductName('Blue Cotton T-Shirt!')).toBe(
      'blue-cotton-t-shirt',
    );
    expect(slugifyProductName('  --Spaced--  ')).toBe('spaced');
  });

  it('falls back to a seeded product slug when the name has no alphanumerics', () => {
    expect(buildProductSlugBase('!!!', 'SKU-9')).toBe('product-sku-9');
    expect(buildProductSlugBase('!!!', '')).toBe('product');
  });

  it('appends a numeric suffix only after the first candidate', () => {
    expect(withSlugSuffix('shirt', 1)).toBe('shirt');
    expect(withSlugSuffix('shirt', 2)).toBe('shirt-2');
  });

  it('returns the base slug when it is free', async () => {
    const findOwner = jest.fn().mockResolvedValue(null);
    await expect(
      ensureUniqueProductSlug(findOwner, 'Shirt', 'SKU-1'),
    ).resolves.toBe('shirt');
  });

  it('dedupes against existing owners', async () => {
    const findOwner = jest
      .fn()
      .mockResolvedValueOnce({ id: 1 })
      .mockResolvedValueOnce({ id: 2 })
      .mockResolvedValueOnce(null);

    await expect(
      ensureUniqueProductSlug(findOwner, 'Shirt', 'SKU-1'),
    ).resolves.toBe('shirt-3');
  });

  it('ignores the product being updated', async () => {
    const findOwner = jest.fn().mockResolvedValue({ id: 5 });
    await expect(
      ensureUniqueProductSlug(findOwner, 'Shirt', 'SKU-1', 5),
    ).resolves.toBe('shirt');
  });
});
