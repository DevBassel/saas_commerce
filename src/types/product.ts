import type { Category } from "./category";

export interface ProductImage {
  id: number;
  url: string;
  mimeType: string;
  sizeBytes: number;
  position: number;
}

export interface Product {
  id: number;
  name: string;
  sku: string;
  description?: string | null;
  price: number;
  stock: number;
  isActive: boolean;
  categoryId?: number | null;
  category?: Category | null;
  createdAt: string;
  updatedAt: string;
  images: ProductImage[];
}
