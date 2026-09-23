"use client";

import { Badge } from "@/components/ui/badge";
import { ORDER_STATUS_LABELS, PAYMENT_STATUS_LABELS } from "@/constants/orders";
import type { OrderStatus, PaymentStatus } from "@/types/order";

type BadgeVariant = "default" | "secondary" | "destructive" | "outline";

const ORDER_STATUS_VARIANTS: Record<OrderStatus, BadgeVariant> = {
  PENDING: "outline",
  CONFIRMED: "secondary",
  PROCESSING: "default",
  SHIPPED: "default",
  DELIVERED: "secondary",
  RETURN_REQUESTED: "outline",
  RETURNED: "secondary",
  CANCELLED: "destructive",
};

const PAYMENT_STATUS_VARIANTS: Record<PaymentStatus, BadgeVariant> = {
  UNPAID: "outline",
  PAID: "default",
  PARTIALLY_REFUNDED: "secondary",
  REFUNDED: "secondary",
  FAILED: "destructive",
};

export const OrderStatusBadge = ({ status }: { status: OrderStatus }) => (
  <Badge variant={ORDER_STATUS_VARIANTS[status]}>
    {ORDER_STATUS_LABELS[status]}
  </Badge>
);

OrderStatusBadge.displayName = "OrderStatusBadge";

export const PaymentStatusBadge = ({ status }: { status: PaymentStatus }) => (
  <Badge variant={PAYMENT_STATUS_VARIANTS[status]}>
    {PAYMENT_STATUS_LABELS[status]}
  </Badge>
);

PaymentStatusBadge.displayName = "PaymentStatusBadge";
