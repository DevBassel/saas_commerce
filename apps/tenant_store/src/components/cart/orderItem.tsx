"use client";
import Image from "next/image";
import { Button } from "../ui/button";
import {
  CheckCircle,
  ClipboardClock,
  LucideIcon,
  Package,
  RotateCcw,
  Truck,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  CancelOrder,
  IOrder,
  OrderStatus,
  PaymentStatus,
  RequestReturn,
} from "@/api/orderApi";
import { handelError } from "@/api/handelError";
import { toast } from "sonner";

const STATUS_META: Record<
  OrderStatus,
  { label: string; icon: LucideIcon; badge: string }
> = {
  PENDING: {
    label: "Pending",
    icon: ClipboardClock,
    badge: "bg-amber-500/15 text-amber-400",
  },
  CONFIRMED: {
    label: "Confirmed",
    icon: ClipboardClock,
    badge: "bg-sky-500/15 text-sky-400",
  },
  PROCESSING: {
    label: "Processing",
    icon: Package,
    badge: "bg-sky-500/15 text-sky-400",
  },
  SHIPPED: {
    label: "Shipped",
    icon: Truck,
    badge: "bg-violet-500/15 text-violet-400",
  },
  DELIVERED: {
    label: "Delivered",
    icon: CheckCircle,
    badge: "bg-primary/15 text-primary",
  },
  RETURN_REQUESTED: {
    label: "Return requested",
    icon: RotateCcw,
    badge: "bg-orange-500/15 text-orange-400",
  },
  RETURNED: {
    label: "Returned",
    icon: RotateCcw,
    badge: "bg-muted text-muted-foreground",
  },
  CANCELLED: {
    label: "Cancelled",
    icon: XCircle,
    badge: "bg-destructive/15 text-destructive",
  },
};

const PAYMENT_LABELS: Record<PaymentStatus, string> = {
  UNPAID: "Unpaid",
  PAID: "Paid",
  PARTIALLY_REFUNDED: "Partially refunded",
  REFUNDED: "Refunded",
  FAILED: "Failed",
};

const OWNER_CANCELLABLE: OrderStatus[] = ["PENDING", "CONFIRMED"];

export default function OrderItem({ order }: { order: IOrder }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const meta = STATUS_META[order.status];
  const StatusIcon = meta.icon;
  const canCancel = OWNER_CANCELLABLE.includes(order.status);
  const canReturn = order.status === "DELIVERED";
  const address = order.deliveryAddress;

  const run = async (action: () => Promise<unknown>, successMessage: string) => {
    setBusy(true);
    try {
      await action();
      toast.success(successMessage);
      router.refresh();
    } catch (error) {
      handelError(error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <article className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5">
      <header className="flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold">
              Order #{order.orderNumber}
            </h2>
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
                meta.badge,
              )}
            >
              <StatusIcon className="size-3.5" />
              {meta.label}
            </span>
            <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
              {PAYMENT_LABELS[order.paymentStatus]}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Placed on {new Date(order.createdAt).toLocaleString()}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="mr-1 text-xl font-bold text-primary">
            ${order.total.toFixed(2)}
          </span>
          {canCancel && (
            <Button
              disabled={busy}
              variant="destructive"
              onClick={() => run(() => CancelOrder(order.id), "Order cancelled")}
            >
              Cancel
            </Button>
          )}
          {canReturn && (
            <Button
              disabled={busy}
              onClick={() =>
                run(() => RequestReturn(order.id), "Return requested")
              }
            >
              Return
            </Button>
          )}
        </div>
      </header>

      <div className="flex flex-col gap-2">
        {order.items.map((item) => (
          <div
            key={`ORDER_ITEM_${item.id}`}
            onClick={() =>
              item.productId != null &&
              router.push(`/products/${item.productId}`)
            }
            className={cn(
              "flex items-center gap-3 rounded-xl border border-border p-2",
              item.productId != null && "cursor-pointer hover:bg-muted/40",
            )}
          >
            {item.imageUrl ? (
              <Image
                src={item.imageUrl}
                alt={item.name}
                width={48}
                height={48}
                className="size-12 shrink-0 rounded-lg object-cover"
              />
            ) : (
              <div className="size-12 shrink-0 rounded-lg bg-muted" />
            )}
            <div className="flex grow flex-col">
              <span className="line-clamp-1 text-sm font-medium">
                {item.name}
              </span>
              <span className="text-xs text-muted-foreground">
                ${item.unitPrice} × {item.quantity}
              </span>
            </div>
            <span className="text-sm font-semibold">
              ${item.lineTotal.toFixed(2)}
            </span>
          </div>
        ))}
      </div>

      {address && (
        <div className="rounded-xl bg-muted/40 p-3 text-sm">
          <p className="font-medium">Delivery address</p>
          <p className="text-muted-foreground">
            {address.recipientName}, {address.line1}
            {address.line2 ? `, ${address.line2}` : ""}, {address.city}
            {address.state ? `, ${address.state}` : ""} {address.postalCode},{" "}
            {address.country}
          </p>
          <p className="text-muted-foreground">{address.phone}</p>
        </div>
      )}
    </article>
  );
}
