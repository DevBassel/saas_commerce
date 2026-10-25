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

export interface IProductPage {
  data: IProduct[];
  total: number;
  page: number;
  limit: number;
}

export interface ProductPageParams {
  page: number;
  limit: number;
  search?: string;
  categoryId?: number;
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
  sortBy?: "createdAt" | "price" | "name";
  sortOrder?: "asc" | "desc";
}

type ProductRequestParam = string | number | boolean;

export async function getProducts(
  config?: AxiosRequestConfig,
  client: AxiosInstance = apiClient,
): Promise<IProduct[]> {
  const res = await client.get<IProduct[]>("/products", config);
  return res.data;
}

export async function getProductPage(
  params: ProductPageParams,
  config?: AxiosRequestConfig,
  client: AxiosInstance = apiClient,
): Promise<IProductPage> {
  const requestParams: Record<string, ProductRequestParam> = {
    ...(config?.params as Record<string, ProductRequestParam> | undefined),
  };

  // Explicit typed arguments take precedence over caller-supplied config params.
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) requestParams[key] = value;
  }

  const res = await client.get<IProductPage>("/products", {
    ...config,
    params: requestParams,
  });
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
