import { R2Service } from '../../../common/storage/r2.service';
import { serializeCategory } from '../../categories/categories.service';
import { Product } from '../entities/product.entity';
import { SerializedProduct } from '../constants/products.interface';

export const serializeProduct = (
  product: Product,
  r2: R2Service,
): SerializedProduct => {
  const { images, category, ...rest } = product;
  return {
    ...rest,
    category: category ? serializeCategory(category) : null,
    images: (images ?? [])
      .slice()
      .sort((a, b) => a.position - b.position)
      .map((image) => ({
        id: image.id,
        url: r2.publicUrl(image.objectKey),
        mimeType: image.mimeType,
        sizeBytes: image.sizeBytes,
        position: image.position,
      })),
  };
};
