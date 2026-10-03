import { apiClient } from "./apiClient";
import type { AxiosInstance, AxiosRequestConfig } from "axios";
import type { CouponDiscountType } from "./couponsApi";

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
  | "CANCELED"
  | "PENDING"
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

/** Frozen coupon snapshot attached to an order when a coupon was redeemed. */
export interface IOrderCoupon {
  id: number;
  code: string | null;
  type: CouponDiscountType | null;
  value: number | null;
}

export interface IOrder {
  id: number;
  orderNumber: string;
  userId?: number | null;
  user?: { id: number; name: string } | null;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  subtotal: number;
  discountAmount: number;
  coupon: IOrderCoupon | null;
  total: number;
  items: IOrderItem[];
  deliveryAddress: IDeliveryAddress | null;
  paidAt: string | null;
  refundedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export async function PlaceOrderReq(
  { addressId, couponCode }: { addressId?: number; couponCode?: string } = {},
  client: AxiosInstance = apiClient,
): Promise<IOrder> {
  const body: { addressId?: number; couponCode?: string } = {};
  if (addressId != null) body.addressId = addressId;
  if (couponCode) body.couponCode = couponCode;
  const res = await client.post<IOrder>("/orders", body);
  return res.data;
}

export interface IOrderPage {
  data: IOrder[];
  total: number;
  page: number;
  limit: number;
}

export async function GetUserOrders(
  config?: AxiosRequestConfig,
  client: AxiosInstance = apiClient,
): Promise<IOrder[]> {
  const res = await client.get<IOrder[]>("/orders", config);
  return res.data;
}

export async function GetUserOrdersPage(
  params: { page: number; limit: number },
  config?: AxiosRequestConfig,
  client: AxiosInstance = apiClient,
): Promise<IOrderPage> {
  const res = await client.get<IOrderPage>("/orders", {
    ...config,
    params: { ...config?.params, page: params.page, limit: params.limit },
  });
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
