import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { ListProductsQueryDto } from './list-products.query.dto';

const pipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
});

const parse = async (
  query: Record<string, unknown>,
): Promise<ListProductsQueryDto> =>
  (await pipe.transform(query, {
    type: 'query',
    metatype: ListProductsQueryDto,
  })) as ListProductsQueryDto;

describe('ListProductsQueryDto', () => {
  it('keeps pagination absent by default and when only filters are supplied', async () => {
    expect(await parse({})).toEqual({});
    const query = await parse({ search: '  shirt  ', inStock: 'false' });

    expect(query).toBeInstanceOf(ListProductsQueryDto);
    expect(query).toEqual({ search: 'shirt', inStock: false });
    expect(query.page).toBeUndefined();
    expect(query.limit).toBeUndefined();
  });

  it('transforms every supported scalar without clamping the requested limit', async () => {
    expect(
      await parse({
        search: ' Shirt ',
        categoryId: '3',
        minPrice: '0',
        maxPrice: '500.50',
        inStock: 'true',
        sortBy: 'price',
        sortOrder: 'ASC',
        page: '2',
        limit: '100',
      }),
    ).toEqual({
      search: 'Shirt',
      categoryId: 3,
      minPrice: 0,
      maxPrice: 500.5,
      inStock: true,
      sortBy: 'price',
      sortOrder: 'asc',
      page: 2,
      limit: 100,
    });
  });

  it.each([
    { minPrice: '0' },
    { maxPrice: '0' },
    { minPrice: '10.50', maxPrice: '10.50' },
    { minPrice: '0', maxPrice: '0' },
    { minPrice: 1.25, maxPrice: 2.5 },
    { minPrice: '1e2', maxPrice: '200' },
  ])('accepts valid price bounds %j', async (query) => {
    await expect(parse(query)).resolves.toBeInstanceOf(ListProductsQueryDto);
  });

  it.each([
    ['ASC', 'asc'],
    ['DESC', 'desc'],
    ['asc', 'asc'],
    ['desc', 'desc'],
  ])('normalizes sortOrder %s to %s', async (input, expected) => {
    expect((await parse({ sortOrder: input })).sortOrder).toBe(expected);
  });

  it.each([
    'name',
    'sku',
    'slug',
    'price',
    'stock',
    'isActive',
    'categoryId',
    'createdAt',
    'updatedAt',
  ])('accepts the product sort field %s', async (sortBy) => {
    expect((await parse({ sortBy })).sortBy).toBe(sortBy);
  });

  it('accepts a 255-character trimmed search and preserves literal search text', async () => {
    const search = 'x'.repeat(255);
    expect((await parse({ search: ` ${search} ` })).search).toBe(search);
    const literal = "50%_off\\sale' OR 1=1 --";
    expect((await parse({ search: literal })).search).toBe(literal);
  });

  it.each([
    'search',
    'categoryId',
    'minPrice',
    'maxPrice',
    'inStock',
    'page',
    'limit',
    'sortBy',
    'sortOrder',
  ])('rejects repeated and nested scalar input for %s', async (field) => {
    for (const value of [
      ['1'],
      ['1', '2'],
      { value: '1' },
      { toString: '1' },
      [],
    ]) {
      await expect(parse({ [field]: value })).rejects.toThrow(
        BadRequestException,
      );
    }
  });

  it.each(['categoryId', 'minPrice', 'maxPrice', 'page', 'limit'])(
    'rejects malformed numeric input for %s',
    async (field) => {
      for (const value of [
        '',
        '  ',
        '1abc',
        '1,000',
        '0x10',
        '0b10',
        'NaN',
        'Infinity',
        '-Infinity',
        '1e309',
        Number.NaN,
        Number.POSITIVE_INFINITY,
        true,
        false,
        null,
      ]) {
        await expect(parse({ [field]: value })).rejects.toThrow(
          BadRequestException,
        );
      }
    },
  );

  it.each(['page', 'limit', 'categoryId'])(
    'rejects non-positive or fractional %s',
    async (field) => {
      for (const value of ['0', '-1', '1.5']) {
        await expect(parse({ [field]: value })).rejects.toThrow(
          BadRequestException,
        );
      }
    },
  );

  it('rejects category IDs outside the PostgreSQL integer range', async () => {
    expect((await parse({ categoryId: '2147483647' })).categoryId).toBe(
      2147483647,
    );
    await expect(parse({ categoryId: '2147483648' })).rejects.toThrow(
      BadRequestException,
    );
  });

  it.each([
    { search: '' },
    { search: ' \t\n ' },
    { search: 'x'.repeat(256) },
    { search: 12 },
    { search: null },
    { minPrice: '-0.01' },
    { maxPrice: '-1' },
    { minPrice: '20', maxPrice: '10' },
    { sortBy: 'id' },
    { sortBy: 'images' },
    { sortBy: 'price; DROP TABLE products' },
    { sortOrder: 'sideways' },
    { inStock: '' },
    { inStock: '1' },
    { inStock: '0' },
    { inStock: 'yes' },
    { inStock: 'TRUE' },
    { inStock: 1 },
    { inStock: null },
  ])('rejects invalid query %j', async (query) => {
    await expect(parse(query)).rejects.toThrow(BadRequestException);
  });

  it('reports reversed bounds through the existing HTTP 400 error shape', async () => {
    expect.assertions(3);
    try {
      await parse({ minPrice: '2', maxPrice: '1' });
    } catch (error) {
      expect(error).toBeInstanceOf(BadRequestException);
      const response = (error as BadRequestException).getResponse() as {
        statusCode: number;
        message: string[];
      };
      expect(response.statusCode).toBe(400);
      expect(response.message).toContain(
        'minPrice must be less than or equal to maxPrice',
      );
    }
  });

  it.each([
    'tenant',
    'tenantId',
    'tenantSchema',
    'schemaName',
    'isActive',
    'brand',
    'rating',
    'attributes',
  ])('rejects the unknown query field %s', async (field) => {
    await expect(parse({ [field]: 'override' })).rejects.toThrow(
      BadRequestException,
    );
  });
});
