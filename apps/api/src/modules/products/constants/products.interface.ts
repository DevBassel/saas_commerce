import type { SerializedCategory } from '../../categories/constants/categories.interface';

export interface SerializedImage {
  id: number;
  url: string;
  mimeType: string;
  sizeBytes: number;
  position: number;
}

export interface SerializedProduct {
  id: number;
  name: string;
  sku: string;
  description?: string | null;
  price: number;
  stock: number;
  isActive: boolean;
  categoryId?: number | null;
  category?: SerializedCategory | null;
  createdAt: Date;
  updatedAt: Date;
  images: SerializedImage[];
}
