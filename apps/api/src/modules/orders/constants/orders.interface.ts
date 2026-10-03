import { PaymentStatus } from 'src/modules/payments/constants/payment-status.enum';
import { DiscountType } from 'src/modules/coupons/constants/discount-type.enum';
import { OrderStatus } from './order-status.enum';

export interface SerializedOrderItem {
  id: number;
  productId: number | null;
  name: string;
  sku: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
  imageUrl: string | null;
}

export interface SerializedDeliveryAddress {
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

export interface SerializedOrderCoupon {
  id: number;
  code: string | null;
  type: DiscountType | null;
  value: number | null;
}

export interface SerializedOrder {
  id: number;
  orderNumber: string;
  userId?: number | null;
  user?: {
    id: number;
    name: string;
  } | null;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  subtotal: number;
  discountAmount: number;
  coupon: SerializedOrderCoupon | null;
  total: number;
  items: SerializedOrderItem[];
  deliveryAddress: SerializedDeliveryAddress | null;
  paidAt: Date | null;
  refundedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
