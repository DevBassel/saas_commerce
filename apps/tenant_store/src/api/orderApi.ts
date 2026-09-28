import { apiClient } from "./apiClient";
import type { AxiosInstance, AxiosRequestConfig } from "axios";

export type OrderStatus =
  | "PENDING"
  | "CONFIRMED"
  | "PROCESSING"
  | "SHIPPED"
  | "DELIVERED"
  | "RETURN_REQUESTED"
  | "RETURNED"
  | "CANCELLED";

export type PaymentStatus =
  | "UNPAID"
  | "PAID"
  | "PARTIALLY_REFUNDED"
  | "REFUNDED"
  | "FAILED";

export interface IOrderItem {
  id: number;
  productId: number | null;
  name: string;
  sku: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
  imageUrl: string | null;
}

export interface IDeliveryAddress {
  addressId: number | null;
  recipientName: string;
  phone: string;
  line1: string;
  line2: string | null;
  city: string;
  state: string | null;
  postalCode: string;
  country: string;
}

export interface IOrder {
  id: number;
  orderNumber: string;
  userId?: number | null;
  user?: { id: number; name: string } | null;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  subtotal: number;
  total: number;
  items: IOrderItem[];
  deliveryAddress: IDeliveryAddress | null;
  paidAt: string | null;
  refundedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export async function PlaceOrderReq(
  { addressId }: { addressId?: number } = {},
  client: AxiosInstance = apiClient,
): Promise<IOrder> {
  const res = await client.post<IOrder>(
    "/orders",
    addressId != null ? { addressId } : {},
  );
  return res.data;
}

export async function GetUserOrders(
  config?: AxiosRequestConfig,
  client: AxiosInstance = apiClient,
): Promise<IOrder[]> {
  const res = await client.get<IOrder[]>("/orders", config);
  return res.data;
}

export async function GetOrder(
  id: number,
  client: AxiosInstance = apiClient,
): Promise<IOrder> {
  const res = await client.get<IOrder>(`/orders/${id}`);
  return res.data;
}

export async function CancelOrder(
  id: number,
  client: AxiosInstance = apiClient,
): Promise<IOrder> {
  const res = await client.patch<IOrder>(`/orders/${id}/cancel`);
  return res.data;
}

export async function RequestReturn(
  id: number,
  client: AxiosInstance = apiClient,
): Promise<IOrder> {
  const res = await client.patch<IOrder>(`/orders/${id}/return`);
  return res.data;
}
