import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateProductDto } from './create-product.dto';

const valid = (): Record<string, unknown> => ({
  name: 'Widget',
  sku: 'WIDGET-001',
  price: 19.99,
});

const check = (payload: Record<string, unknown>) =>
  validate(plainToInstance(CreateProductDto, payload));

const hasError = (errors: { property: string }[], property: string) =>
  errors.some((e) => e.property === property);

describe('CreateProductDto', () => {
  it('accepts a minimal valid payload', async () => {
    await expect(check(valid())).resolves.toHaveLength(0);
  });

  it('accepts all optional fields', async () => {
    const errors = await check({
      ...valid(),
      description: 'A widget',
      stock: 0,
      isActive: false,
      categoryId: 1,
    });
    expect(errors).toHaveLength(0);
  });

  it.each(['name', 'sku', 'price'])(
    'rejects a payload missing the required field %s',
    async (field) => {
      const payload = valid();
      delete payload[field];
      const errors = await check(payload);
      expect(hasError(errors, field)).toBe(true);
    },
  );

  it.each(['Widget', 'AB', 'A'.repeat(255)])(
    'accepts the valid name %p',
    async (name) => {
      await expect(check({ ...valid(), name })).resolves.toHaveLength(0);
    },
  );

  it.each(['A', '', 'x'.repeat(256)])(
    'rejects the invalid name %p',
    async (name) => {
      const errors = await check({ ...valid(), name });
      expect(hasError(errors, 'name')).toBe(true);
    },
  );

  it.each(['WIDGET-001', 'a_b-9', 'A1'])(
    'accepts the valid sku %p',
    async (sku) => {
      await expect(check({ ...valid(), sku })).resolves.toHaveLength(0);
    },
  );

  it.each(['-WIDGET', '_WIDGET', 'WIDGET 001', 'WIDGET.001', ''])(
    'rejects the malformed sku %p',
    async (sku) => {
      const errors = await check({ ...valid(), sku });
      expect(hasError(errors, 'sku')).toBe(true);
    },
  );

  it('rejects a sku longer than 64 characters', async () => {
    const errors = await check({ ...valid(), sku: 'A'.repeat(65) });
    expect(hasError(errors, 'sku')).toBe(true);
  });

  it.each([0, 0.5, 99999999.99])(
    'accepts the valid price %p',
    async (price) => {
      await expect(check({ ...valid(), price })).resolves.toHaveLength(0);
    },
  );

  it.each([-0.01, 100000000, 1.234, '19.99'])(
    'rejects the out-of-range, over-precise or non-numeric price %p',
    async (price) => {
      const errors = await check({ ...valid(), price });
      expect(hasError(errors, 'price')).toBe(true);
    },
  );

  it('rejects a non-numeric price', async () => {
    const errors = await check({ ...valid(), price: 'free' });
    expect(hasError(errors, 'price')).toBe(true);
  });

  it.each([0, 1, 100])('accepts the valid stock %p', async (stock) => {
    await expect(check({ ...valid(), stock })).resolves.toHaveLength(0);
  });

  it.each([-1, 1.5, '5'])('rejects the invalid stock %p', async (stock) => {
    const errors = await check({ ...valid(), stock });
    expect(hasError(errors, 'stock')).toBe(true);
  });

  it('rejects a non-boolean isActive', async () => {
    const errors = await check({ ...valid(), isActive: 'true' });
    expect(hasError(errors, 'isActive')).toBe(true);
  });

  it.each([1, 42])('accepts the valid categoryId %p', async (categoryId) => {
    await expect(check({ ...valid(), categoryId })).resolves.toHaveLength(0);
  });

  it.each([0, -1, 1.5])(
    'rejects the invalid categoryId %p',
    async (categoryId) => {
      const errors = await check({ ...valid(), categoryId });
      expect(hasError(errors, 'categoryId')).toBe(true);
    },
  );
});
