import { BadRequestException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { TenantRef } from '../tenants/utils/tenant.utils';
import { R2Service } from '../../common/storage/r2.service';
import StripePaymentService from '../payments/stripe.payment.service';
import { PaymentStatus } from '../payments/constants/payment-status.enum';
import { Product } from '../products/entities/product.entity';
import { Order } from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';
import {
  SerializedDeliveryAddress,
  SerializedOrder,
  SerializedOrderItem,
} from './constants/orders.interface';

export function serializeOrder(order: Order, r2: R2Service): SerializedOrder {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    userId: order.userId ?? null,
    user: order.user
      ? {
          id: order.user.id,
          name: order.user.name,
        }
      : null,
    status: order.status,
    paymentStatus: order.paymentStatus,
    subtotal: order.subtotal,
    discountAmount: order.discountAmount ?? 0,
    coupon:
      order.couponId != null
        ? {
            id: order.couponId,
            code: order.couponCode ?? null,
            type: order.couponDiscountType ?? null,
            value: order.couponDiscountValue ?? null,
          }
        : null,
    total: order.total,
    items: (order.items ?? [])
      .slice()
      .sort((a, b) => a.id - b.id)
      .map((item) => serializeOrderItem(item, r2)),
    deliveryAddress: serializeDeliveryAddress(order),
    paidAt: order.paidAt ?? null,
    refundedAt: order.refundedAt ?? null,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
  };
}

export function serializeDeliveryAddress(
  order: Order,
): SerializedDeliveryAddress | null {
  if (order.addressId == null && order.recipientName == null) return null;
  return {
    addressId: order.addressId ?? null,
    recipientName: order.recipientName ?? '',
    phone: order.phone ?? '',
    line1: order.line1 ?? '',
    line2: order.line2 ?? null,
    city: order.city ?? '',
    state: order.state ?? null,
    postalCode: order.postalCode ?? '',
    country: order.country ?? '',
  };
}

export function serializeOrderItem(
  item: OrderItem,
  r2: R2Service,
): SerializedOrderItem {
  return {
    id: item.id,
    productId: item.productId ?? null,
    name: item.name,
    sku: item.sku,
    unitPrice: item.unitPrice,
    quantity: item.quantity,
    lineTotal: item.lineTotal,
    imageUrl: item.imageObjectKey ? r2.publicUrl(item.imageObjectKey) : null,
  };
}

/**
 * Refunds a paid order (full refund) and returns the refund timestamp, or
 * null when the order was never paid. Throws before the order is cancelled
 * when a payment is marked paid but cannot be refunded.
 */
export async function refundOrderIfPaid(
  order: Order,
  tenant: TenantRef,
  payments: StripePaymentService,
): Promise<Date | null> {
  if (order.paymentStatus !== PaymentStatus.PAID) return null;

  const result = await payments.refundOrder(order, tenant);
  if (!result) {
    throw new BadRequestException(
      'Order is marked paid but has no refundable payment',
    );
  }
  return result.refundedAt;
}

export async function restockOrderItems(
  manager: EntityManager,
  items: OrderItem[],
): Promise<void> {
  const products = manager.getRepository(Product);
  for (const item of items) {
    if (item.productId == null) continue;
    await products.increment({ id: item.productId }, 'stock', item.quantity);
  }
}
