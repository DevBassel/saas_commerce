import { ROLE_RANK, rankOf } from "@/constants/users";
import type { OrderStatus, PaymentStatus } from "@/types/order";

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING: "Pending",
  CONFIRMED: "Confirmed",
  PROCESSING: "Processing",
  SHIPPED: "Shipped",
  DELIVERED: "Delivered",
  RETURN_REQUESTED: "Return requested",
  RETURNED: "Returned",
  CANCELLED: "Cancelled",
};

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  UNPAID: "Unpaid",
  PAID: "Paid",
  PARTIALLY_REFUNDED: "Partially refunded",
  REFUNDED: "Refunded",
  FAILED: "Failed",
};

export const ORDER_STATUSES: OrderStatus[] = [
  "PENDING",
  "CONFIRMED",
  "PROCESSING",
  "SHIPPED",
  "DELIVERED",
  "RETURN_REQUESTED",
  "RETURNED",
  "CANCELLED",
];

export const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["PROCESSING", "CANCELLED"],
  PROCESSING: ["SHIPPED", "CANCELLED"],
  SHIPPED: ["DELIVERED", "CANCELLED"],
  DELIVERED: ["RETURN_REQUESTED"],
  RETURN_REQUESTED: ["RETURNED", "DELIVERED"],
  RETURNED: [],
  CANCELLED: [],
};

export const TERMINAL_ORDER_STATUSES: OrderStatus[] = [
  "DELIVERED",
  "RETURNED",
  "CANCELLED",
];

export const OWNER_CANCELLABLE_STATUSES: OrderStatus[] = [
  "PENDING",
  "CONFIRMED",
];

export const MANAGER_CANCELLABLE_STATUSES: OrderStatus[] = [
  "PENDING",
  "CONFIRMED",
  "PROCESSING",
  "SHIPPED",
];

export const nextStatuses = (status: OrderStatus): OrderStatus[] =>
  ORDER_TRANSITIONS[status] ?? [];

export const isTerminalStatus = (status: OrderStatus): boolean =>
  TERMINAL_ORDER_STATUSES.includes(status);

export const canManageOrders = (roleKey?: string | null): boolean =>
  rankOf(roleKey) >= (ROLE_RANK.ADMIN ?? 0);

export const canCancelOrder = (
  status: OrderStatus,
  roleKey?: string | null,
): boolean =>
  canManageOrders(roleKey)
    ? MANAGER_CANCELLABLE_STATUSES.includes(status)
    : OWNER_CANCELLABLE_STATUSES.includes(status);
