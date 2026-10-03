import { ProductImage } from '../entities/product-image.entity';
import { primaryImage } from './product-image.util';

const image = (overrides: Partial<ProductImage>): ProductImage =>
  ({ id: 1, position: 0, ...overrides }) as ProductImage;

describe('primaryImage', () => {
  it('returns undefined for missing or empty image lists', () => {
    expect(primaryImage()).toBeUndefined();
    expect(primaryImage([])).toBeUndefined();
  });

  it('returns the single image when only one exists', () => {
    const only = image({ id: 1, position: 5 });
    expect(primaryImage([only])).toBe(only);
  });

  it('picks the lowest position', () => {
    const low = image({ id: 9, position: 0 });
    const high = image({ id: 1, position: 3 });
    expect(primaryImage([high, low])).toBe(low);
  });

  it('tie-breaks equal positions by the lowest id', () => {
    const first = image({ id: 2, position: 1 });
    const second = image({ id: 7, position: 1 });
    expect(primaryImage([second, first])).toBe(first);
  });

  it('ignores id order when positions differ', () => {
    const byPosition = image({ id: 99, position: 0 });
    const lowId = image({ id: 1, position: 4 });
    expect(primaryImage([lowId, byPosition])).toBe(byPosition);
  });
});
