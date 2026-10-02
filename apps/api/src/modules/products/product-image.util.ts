import { ProductImage } from './entities/product-image.entity';

/**
 * Picks a product's primary image: lowest `position`, tie-broken by lowest id.
 */
export function primaryImage(
  images?: ProductImage[],
): ProductImage | undefined {
  if (!images || images.length === 0) return undefined;
  return images.reduce((best, image) => {
    if (image.position < best.position) return image;
    if (image.position === best.position && image.id < best.id) return image;
    return best;
  });
}
