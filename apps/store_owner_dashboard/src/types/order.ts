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

export interface OrderItem {
  id: number;
  productId: number | null;
  name: string;
  sku: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
  imageUrl: string | null;
}

export interface DeliveryAddress {
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

export interface Order {
  id: number;
  orderNumber: string;
  userId: number;
  user: {
    id: number;
    name: string;
  };
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  subtotal: number;
  total: number;
  items: OrderItem[];
  deliveryAddress: DeliveryAddress | null;
  paidAt: string | null;
  refundedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
