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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { DashboardStats } from "@/types/dashboard";
import type { Order } from "@/types/order";

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

const formatDate = (value?: string | null) =>
  value ? new Date(value).toLocaleString() : "—";

const RECENT_ORDERS_LIMIT = 5;

const StatCard = ({
  title,
  value,
  icon: Icon,
  isLoading,
  isError,
}: {
  title: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  isLoading: boolean;
  isError: boolean;
}) => (
  <Card>
    <CardHeader className="flex flex-row items-center justify-between pb-2">
      <CardTitle className="text-sm font-medium text-muted-foreground">
        {title}
      </CardTitle>
      <Icon className="h-4 w-4 text-muted-foreground" />
    </CardHeader>
    <CardContent>
      {isLoading ? (
        <Skeleton className="h-8 w-16" />
      ) : (
        <div className="text-2xl font-bold">{isError ? "—" : value}</div>
      )}
    </CardContent>
  </Card>
);

export const Dashboard = () => {
  const ordersQuery = useList<Order>({
    resource: "orders",
    pagination: { mode: "off" },
    sorters: [{ field: "createdAt", order: "desc" }],
    meta: { omitListParams: true },
  });
  const statsQuery = useCustom<DashboardStats>({
    url: "dashboard/stats",
    method: "get",
  });

  const orders = ordersQuery.query.data?.data ?? [];
  const stats = statsQuery.query.data?.data;

  const recentOrders = orders.slice(0, RECENT_ORDERS_LIMIT);

  return (
    <div className="flex flex-col gap-6 p-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
          value={currency.format(stats?.totalPaid ?? 0)}
          icon={CreditCardIcon}
          isLoading={statsQuery.query.isLoading}
          isError={statsQuery.query.isError}
        />
        <StatCard
          title="Waiting Money"
          value={currency.format(stats?.waitingAmount ?? 0)}
          icon={HourglassIcon}
          isLoading={statsQuery.query.isLoading}
          isError={statsQuery.query.isError}
        />
        <StatCard
          title="Customers"
          value={String(stats?.customers ?? 0)}
          icon={UsersIcon}
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
                    "items-center",
                    "justify-between",
                    "gap-4",
                    "py-3",
                  )}
                >
                  <div className={cn("flex", "flex-col")}>
                    <span className="text-sm font-medium">
                      {order.orderNumber}
                    </span>
                    <span className={cn("text-xs", "text-muted-foreground")}>
                      {order.userId == null ? "Deleted user" : order.user.name}{" "}
                      · {formatDate(order.createdAt)}
                    </span>
                  </div>
                  <div className={cn("flex", "items-center", "gap-3")}>
                    <OrderStatusBadge status={order.status} />
                    <span className="text-sm font-semibold">
                      {currency.format(order.total)}
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
