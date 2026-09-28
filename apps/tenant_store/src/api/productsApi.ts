import { apiClient } from "./apiClient";
import type { AxiosInstance, AxiosRequestConfig } from "axios";

export interface IProductImage {
  id: number;
  url: string;
  mimeType: string;
  sizeBytes: number;
  position: number;
}

export interface ICategory {
  id: number;
  name: string;
  slug: string;
  description?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface IProduct {
  id: number;
  name: string;
  sku: string;
  slug: string | null;
  description?: string | null;
  price: number;
  stock: number;
  isActive: boolean;
  categoryId?: number | null;
  category?: ICategory | null;
  createdAt: string;
  updatedAt: string;
  images: IProductImage[];
}

export async function getProducts(
  config?: AxiosRequestConfig,
  client: AxiosInstance = apiClient,
): Promise<IProduct[]> {
  const res = await client.get<IProduct[]>("/products", config);
  return res.data;
}

export async function getProductById(
  id: number,
  config?: AxiosRequestConfig,
  client: AxiosInstance = apiClient,
): Promise<IProduct> {
  const res = await client.get<IProduct>(`/products/${id}`, config);
  return res.data;
}
