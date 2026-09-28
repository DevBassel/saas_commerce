import type { AxiosInstance } from "axios";
import { apiClient } from "./apiClient";

export interface ICartItem {
  productId: number;
  name: string;
  sku: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
  isActive: boolean;
  isAvailable: boolean;
  availableStock: number;
  imageUrl: string | null;
}

export interface ICart {
  id: number | null;
  userId: number;
  items: ICartItem[];
  subtotal: number;
  totalItems: number;
  totalQuantity: number;
  createdAt: string | null;
  updatedAt: string | null;
}

export async function GetUserCart(
  client: AxiosInstance = apiClient,
): Promise<ICart> {
  const res = await client.get<ICart>("/cart");
  return res.data;
}

export async function AddToCart(
  {
    productId,
    quantity,
  }: {
    productId: number;
    quantity?: number;
  },
  client: AxiosInstance = apiClient,
): Promise<ICart> {
  const res = await client.post<ICart>("/cart/items", {
    productId,
    quantity,
  });
  return res.data;
}

export async function UpdateCartItem(
  {
    productId,
    quantity,
  }: {
    productId: number;
    quantity: number;
  },
  client: AxiosInstance = apiClient,
): Promise<ICart> {
  const res = await client.patch<ICart>(`/cart/items/${productId}`, {
    quantity,
  });
  return res.data;
}

export async function RemoveItemFromCart(
  {
    productId,
  }: {
    productId: number;
  },
  client: AxiosInstance = apiClient,
): Promise<ICart> {
  const res = await client.delete<ICart>(`/cart/items/${productId}`);
  return res.data;
}

export async function ClearCart(
  client: AxiosInstance = apiClient,
): Promise<ICart> {
  const res = await client.delete<ICart>("/cart");
  return res.data;
}
