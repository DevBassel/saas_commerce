"use client";

import { useState } from "react";
import {
  useGetIdentity,
  useInvalidate,
  useNotification,
} from "@refinedev/core";
import { Loader2 } from "lucide-react";

import { toApiError } from "@/api/client";
import { ordersApi } from "@/api/orders.api";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ORDER_STATUS_LABELS,
  ORDER_STATUSES,
  canCancelOrder,
  canManageOrders,
} from "@/constants/orders";
import { cn } from "@/lib/utils";
import type { Order, OrderStatus } from "@/types/order";
import type { ActorIdentity } from "@/types/user";

export const OrderStatusActions = ({ order }: { order: Order }) => {
  const { data: identity } = useGetIdentity<ActorIdentity>();
  const roleKey = identity?.roles?.[0] ?? null;

  const invalidate = useInvalidate();
  const { open } = useNotification();

  const [busyStatus, setBusyStatus] = useState<OrderStatus | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const manageable = canManageOrders(roleKey);
  const cancellable = canCancelOrder(order.status, roleKey);
  const isSubmitting = busyStatus !== null || cancelling;

  const isOptionEnabled = (status: OrderStatus): boolean => {
    if (status === order.status) return false;
    if (status === "CANCELLED") return cancellable;
    return manageable;
  };

  const hasEnabledOption = ORDER_STATUSES.some(isOptionEnabled);

  const refresh = () =>
    invalidate({
      resource: "orders",
      id: order.id,
      invalidates: ["list", "detail"],
    });

  const handleTransition = async (status: OrderStatus) => {
    if (!manageable || isSubmitting) return;
    setBusyStatus(status);
    try {
      await ordersApi.updateStatus(order.id, status);
      refresh();
      open?.({
        type: "success",
        message: "Order updated",
        description: `${order.orderNumber} is now ${ORDER_STATUS_LABELS[
          status
        ].toLowerCase()}.`,
      });
    } catch (error) {
      open?.({
        type: "error",
        message: "Failed to update order",
        description: toApiError(error).message,
      });
    } finally {
      setBusyStatus(null);
    }
  };

  const handleCancel = async () => {
    if (!cancellable || isSubmitting) return;
    setCancelling(true);
    try {
      await ordersApi.cancel(order.id);
      setCancelOpen(false);
      refresh();
      open?.({ type: "success", message: "Order cancelled" });
    } catch (error) {
      open?.({
        type: "error",
        message: "Failed to cancel order",
        description: toApiError(error).message,
      });
    } finally {
      setCancelling(false);
    }
  };

  const handleAction = (action: string) => {
    if (!action || isSubmitting) return;
    if (action === "CANCELLED") {
      setCancelOpen(true);
      return;
    }
    void handleTransition(action as OrderStatus);
  };

  return (
    <div>
      <Select
        value=""
        onValueChange={handleAction}
        disabled={isSubmitting || !hasEnabledOption}
      >
        <SelectTrigger className="w-full">
          <SelectValue
            placeholder={isSubmitting ? "Updating…" : "Change status"}
          />
        </SelectTrigger>
        <SelectContent>
          {ORDER_STATUSES.map((status) => {
            const isCurrent = status === order.status;
            return (
              <SelectItem
                key={status}
                value={status}
                disabled={!isOptionEnabled(status)}
                className={cn(
                  status === "CANCELLED" &&
                    "text-destructive focus:text-destructive",
                )}
              >
                {ORDER_STATUS_LABELS[status]}
                {isCurrent ? " (current)" : ""}
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>

      {isSubmitting ? (
        <p
          className={cn(
            "flex",
            "items-center",
            "gap-2",
            "text-xs",
            "text-muted-foreground",
          )}
        >
          <Loader2 className="h-3 w-3 animate-spin" />
          Updating order…
        </p>
      ) : null}

      {cancellable ? (
        <Dialog
          open={cancelOpen}
          onOpenChange={(next) => {
            if (!isSubmitting) setCancelOpen(next);
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Cancel order?</DialogTitle>
              <DialogDescription>
                Cancelling {order.orderNumber} restocks its items and cannot be
                undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={isSubmitting}
                onClick={() => setCancelOpen(false)}
              >
                Keep order
              </Button>
              <Button
                type="button"
                variant="destructive"
                disabled={isSubmitting}
                onClick={handleCancel}
              >
                {cancelling ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : null}
                Confirm cancel
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  );
};

OrderStatusActions.displayName = "OrderStatusActions";
