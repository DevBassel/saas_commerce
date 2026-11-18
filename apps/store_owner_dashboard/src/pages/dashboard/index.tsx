"use client";

import { useCustom, useList } from "@refinedev/core";
import {
  CircleCheckIcon,
  ClockIcon,
  CreditCardIcon,
  HourglassIcon,
  PackageIcon,
  UsersIcon,
} from "lucide-react";
import { Link } from "react-router";

import { OrderStatusBadge } from "@/components/orders/order-status-badge";
import { StorageCard } from "@/components/dashboard/storage-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatMoney, useTenantCurrency } from "@/lib/currency";
import { cn } from "@/lib/utils";
import type { Balance, DashboardStats } from "@/types/dashboard";
import type { Order } from "@/types/order";
import { StatCard } from "@/components/dashboard/StatCard";

const formatDate = (value?: string | null) =>
  value ? new Date(value).toLocaleString() : "—";

const formatBalance = (
  entries: Balance["available"],
  fallbackCurrency: string,
): string => {
  if (!entries.length) return formatMoney(0, fallbackCurrency);
  return entries
    .map((entry) => formatMoney(entry.amount / 100, entry.currency))
    .join(" · ");
};

const RECENT_ORDERS_LIMIT = 5;

export const Dashboard = () => {
  const ordersQuery = useList<Order>({
    resource: "orders",
    pagination: { currentPage: 1, pageSize: RECENT_ORDERS_LIMIT },
    sorters: [{ field: "createdAt", order: "desc" }],
  });
  const statsQuery = useCustom<DashboardStats>({
    url: "dashboard/stats",
    method: "get",
  });
  const currencyCode = useTenantCurrency();

  const orders = ordersQuery.query.data?.data ?? [];
  const stats = statsQuery.query.data?.data;

  const recentOrders = orders.slice(0, RECENT_ORDERS_LIMIT);

  return (
    <div className="flex flex-col gap-6 p-4">
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Orders"
          value={String(stats?.totalOrders ?? 0)}
          icon={PackageIcon}
          isLoading={statsQuery.query.isLoading}
          isError={statsQuery.query.isError}
        />
        <StatCard
          title="Fulfilled"
          value={String(stats?.fulfilledOrders ?? 0)}
          icon={CircleCheckIcon}
          isLoading={statsQuery.query.isLoading}
          isError={statsQuery.query.isError}
        />
        <StatCard
          title="Pending"
          value={String(stats?.pendingOrders ?? 0)}
          icon={ClockIcon}
          isLoading={statsQuery.query.isLoading}
          isError={statsQuery.query.isError}
        />
        <StatCard
          title="Total Paid"
          value={formatBalance(stats?.balance?.available ?? [], currencyCode)}
          icon={CreditCardIcon}
          isLoading={statsQuery.query.isLoading}
          isError={statsQuery.query.isError}
        />
        <StatCard
          title="Waiting Money"
          value={formatBalance(stats?.balance?.pending ?? [], currencyCode)}
          icon={HourglassIcon}
          isLoading={statsQuery.query.isLoading}
          isError={statsQuery.query.isError}
          className="h-fit"
        />
        <StatCard
          title="Customers"
          value={String(stats?.customers ?? 0)}
          icon={UsersIcon}
          isLoading={statsQuery.query.isLoading}
          isError={statsQuery.query.isError}
          className="h-fit"
        />
        <StorageCard
          usedBytes={stats?.storageUsedBytes ?? 0}
          capacityBytes={stats?.storageCapacityBytes ?? 0}
          schemaSizeBytes={stats?.schemaSizeBytes ?? 0}
          schemaCapacityBytes={stats?.schemaCapacityBytes ?? 0}
          isLoading={statsQuery.query.isLoading}
          isError={statsQuery.query.isError}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent orders</CardTitle>
        </CardHeader>
        <CardContent>
          {ordersQuery.query.isLoading ? (
            <div className={cn("flex", "flex-col", "gap-3")}>
              {Array.from({ length: 3 }).map((_, index) => (
                <Skeleton
                  key={`recent-order-${index}`}
                  className="h-10 w-full"
                />
              ))}
            </div>
          ) : ordersQuery.query.isError ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Orders could not be loaded.
            </p>
          ) : recentOrders.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No orders yet.
            </p>
          ) : (
            <div className={cn("flex", "flex-col", "divide-y")}>
              {recentOrders.map((order) => (
                <Link
                  key={order.id}
                  to={`/orders/show/${order.id}`}
                  className={cn(
                    "flex",
                    "flex-col",
                    "items-start",
                    "justify-between",
                    "gap-2",
                    "py-3",
                    "sm:flex-row",
                    "sm:items-center",
                    "sm:gap-4",
                  )}
                >
                  <div className={cn("flex", "min-w-0", "flex-col")}>
                    <span className="text-sm font-medium">
                      {order.orderNumber}
                    </span>
                    <span
                      className={cn(
                        "text-xs",
                        "text-muted-foreground",
                        "[overflow-wrap:anywhere]",
                      )}
                    >
                      {order.userId == null ? "Deleted user" : order.user.name}{" "}
                      · {formatDate(order.createdAt)}
                    </span>
                  </div>
                  <div
                    className={cn(
                      "flex",
                      "w-full",
                      "items-center",
                      "justify-between",
                      "gap-3",
                      "sm:w-auto",
                    )}
                  >
                    <OrderStatusBadge status={order.status} />
                    <span className="text-sm font-semibold">
                      {formatMoney(order.total, currencyCode)}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

Dashboard.displayName = "Dashboard";
