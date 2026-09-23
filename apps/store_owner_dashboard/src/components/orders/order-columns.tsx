"use client";

import type { ColumnDef } from "@tanstack/react-table";

import { DateCell } from "@/components/refine-ui/data-table/date-cell";
import { sortableHeader } from "@/components/refine-ui/data-table/sortable-header";
import {
  OrderStatusBadge,
  PaymentStatusBadge,
} from "@/components/orders/order-status-badge";
import { OrderRowActions } from "@/components/orders/order-row-actions";
import type { Order } from "@/types/order";
import { Link } from "react-router";

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

export const orderColumns: ColumnDef<Order>[] = [
  {
    accessorKey: "orderNumber",
    header: sortableHeader<Order>("Order"),
    size: 200,
  },
  {
    id: "customer",
    header: "Customer",
    enableSorting: false,
    size: 120,
    cell: ({ row }) =>
      row.original?.user ? (
        <Link
          to={`/users/show/${row.original?.userId}`}
          className="hover:underline text-primary font-bold text-lg"
        >
          {row.original?.user?.name}
        </Link>
      ) : (
        <p className="hover:underline text-red-800 font-bold text-lg">
          Deleted User
        </p>
      ),
  },
  {
    id: "items",
    header: "Items",
    enableSorting: false,
    size: 120,
    cell: ({ row }) => {
      const items = row.original.items ?? [];
      const units = items.reduce((sum, item) => sum + item.quantity, 0);
      return `${units} item${units === 1 ? "" : "s"}`;
    },
  },
  {
    accessorKey: "total",
    header: sortableHeader<Order>("Total"),
    size: 120,
    cell: ({ getValue }) => currency.format(Number(getValue() ?? 0)),
  },
  {
    accessorKey: "status",
    header: "Status",
    enableSorting: false,
    size: 130,
    cell: ({ getValue }) => (
      <OrderStatusBadge status={getValue() as Order["status"]} />
    ),
  },
  {
    accessorKey: "paymentStatus",
    header: "Payment",
    enableSorting: false,
    size: 150,
    cell: ({ getValue }) => (
      <PaymentStatusBadge status={getValue() as Order["paymentStatus"]} />
    ),
  },
  {
    accessorKey: "createdAt",
    header: sortableHeader<Order>("Created"),
    size: 140,
    cell: ({ getValue }) => (
      <DateCell value={getValue() as string | undefined} />
    ),
  },
  {
    id: "actions",
    header: "",
    enableSorting: false,
    size: 80,
    cell: ({ row }) => <OrderRowActions id={row.original.id} />,
  },
];
