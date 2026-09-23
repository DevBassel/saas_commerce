"use client";

import { useShow } from "@refinedev/core";

import { OrderStatusActions } from "@/components/orders/order-status-actions";
import {
  OrderStatusBadge,
  PaymentStatusBadge,
} from "@/components/orders/order-status-badge";
import { DetailRow } from "@/components/refine-ui/views/detail-row";
import {
  ShowView,
  ShowViewHeader,
} from "@/components/refine-ui/views/show-view";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { DeliveryAddress, Order } from "@/types/order";
import { Link } from "react-router";

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

const formatDate = (value?: string | null) =>
  value ? new Date(value).toLocaleString() : "—";

const formatAddress = (address: DeliveryAddress) =>
  [
    [address.line1, address.line2].filter(Boolean).join(", "),
    [address.city, address.state, address.postalCode]
      .filter(Boolean)
      .join(", "),
    address.country,
  ]
    .filter((line): line is string => Boolean(line && line.length > 0))
    .join("\n");

export const OrdersShow = () => {
  const { query } = useShow<Order>({ resource: "orders" });
  const record = query.data?.data;
  const items = record?.items ?? [];

  const title =
    typeof record?.orderNumber === "string" ? record.orderNumber : undefined;

  return (
    <ShowView>
      <ShowViewHeader title={title} hideEdit />
      {query.isLoading ? (
        <div className={cn("grid", "gap-6", "lg:grid-cols-[2fr_1fr]")}>
          <Card>
            <CardHeader>
              <CardTitle>
                <Skeleton className="h-6 w-48" />
              </CardTitle>
            </CardHeader>
            <CardContent className={cn("flex", "flex-col", "gap-4")}>
              {Array.from({ length: 6 }).map((_, index) => (
                <div
                  key={`skeleton-row-${index}`}
                  className={cn("flex", "flex-col", "gap-2")}
                >
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-4 w-64" />
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      ) : !record ? (
        <p
          className={cn(
            "py-8",
            "text-center",
            "text-sm",
            "text-muted-foreground",
          )}
        >
          Order not found.
        </p>
      ) : (
        <div className={cn("grid", "gap-4", "lg:grid-cols-[2fr_1.5fr]")}>
          <Card>
            <CardHeader>
              <CardTitle className={cn("flex", "items-center", "gap-2")}>
                {record.orderNumber}
                <OrderStatusBadge status={record.status} />
                <OrderStatusActions order={record} />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <DetailRow
                label="Status"
                value={<OrderStatusBadge status={record.status} />}
              />
              <Separator />
              <DetailRow
                label="Payment"
                value={<PaymentStatusBadge status={record.paymentStatus} />}
              />
              <Separator />
              <DetailRow
                label="Customer"
                value={
                  record.userId == null ? (
                    "Deleted user"
                  ) : (
                    <Link
                      to={`/users/show/${record.userId}`}
                      className="hover:underline text-primary font-bold text-lg"
                    >
                      {record.user.name}
                    </Link>
                  )
                }
              />
              <Separator />
              <DetailRow
                label="Subtotal"
                value={currency.format(record.subtotal)}
              />
              <Separator />
              <DetailRow label="Total" value={currency.format(record.total)} />
              <Separator />
              <DetailRow label="Created" value={formatDate(record.createdAt)} />
              <Separator />
              <DetailRow label="Paid" value={formatDate(record.paidAt)} />
              <Separator />
              <DetailRow
                label="Refunded"
                value={formatDate(record.refundedAt)}
              />
            </CardContent>
          </Card>
          <div className={cn("flex", "flex-col", "gap-4")}>
            {/* list order items */}
            <Card>
              <CardHeader>
                <CardTitle>Items</CardTitle>
              </CardHeader>
              <CardContent className={cn("flex", "flex-col", "gap-4")}>
                {items.length === 0 ? (
                  <p className={cn("text-sm", "text-muted-foreground")}>
                    No items.
                  </p>
                ) : (
                  <div className={cn("flex", "flex-col", "divide-y")}>
                    {items.map((item) => (
                      <div
                        key={item.id}
                        className={cn(
                          "flex",
                          "items-center",
                          "gap-4",
                          "py-3",
                        )}
                      >
                        {item.imageUrl ? (
                          <img
                            src={item.imageUrl}
                            alt={item.name}
                            loading="lazy"
                            decoding="async"
                            className={cn(
                              "h-12",
                              "w-12",
                              "rounded",
                              "object-cover",
                            )}
                          />
                        ) : (
                          <div
                            className={cn(
                              "h-12",
                              "w-12",
                              "rounded",
                              "bg-muted",
                            )}
                          />
                        )}
                        <div className={cn("flex", "flex-1", "flex-col")}>
                          <Link
                            to={`/products/show/${item.productId}`}
                            className="text-sm font-medium"
                          >
                            {item.name}
                          </Link>
                          <span
                            className={cn("text-xs", "text-muted-foreground")}
                          >
                            {item.sku}
                          </span>
                        </div>
                        <div className={cn("text-right", "text-sm")}>
                          <span className="text-muted-foreground">
                            {currency.format(item.unitPrice)} × {item.quantity}
                          </span>
                          <span className={cn("block", "font-medium")}>
                            {currency.format(item.lineTotal)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <Separator className="bg-primary" />
                <div className={cn("flex", "justify-between", "text-sm")}>
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>{currency.format(record.subtotal)}</span>
                </div>
                <div
                  className={cn("flex", "justify-between", "font-semibold")}
                >
                  <span>Total</span>
                  <span>{currency.format(record.total)}</span>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Delivery Address</CardTitle>
              </CardHeader>
              <CardContent>
                {record.deliveryAddress ? (
                  <>
                    <DetailRow
                      label="Recipient"
                      value={record.deliveryAddress.recipientName}
                    />
                    <Separator />
                    <DetailRow
                      label="Phone"
                      value={record.deliveryAddress.phone}
                    />
                    <Separator />
                    <DetailRow
                      label="Address"
                      value={
                        <span
                          className={cn("whitespace-pre-line", "font-normal")}
                        >
                          {formatAddress(record.deliveryAddress)}
                        </span>
                      }
                    />
                  </>
                ) : (
                  <p className={cn("text-sm", "text-muted-foreground")}>
                    No delivery address on this order.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </ShowView>
  );
};

OrdersShow.displayName = "OrdersShow";
