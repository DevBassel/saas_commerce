"use client";

import type { ColumnDef } from "@tanstack/react-table";

import { ActiveBadge } from "@/components/refine-ui/data-table/active-badge";
import { DateCell } from "@/components/refine-ui/data-table/date-cell";
import { RowActions } from "@/components/refine-ui/data-table/row-actions";
import { sortableHeader } from "@/components/refine-ui/data-table/sortable-header";
import { cn } from "@/lib/utils";
import type { Product } from "@/types/product";

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

export const productColumns: ColumnDef<Product>[] = [
  {
    id: "image",
    header: "Image",
    enableSorting: false,
    size: 80,
    cell: ({ row }) => {
      const url = row.original.images?.[0]?.url;
      return url ? (
        <img
          src={url}
          alt={row.original.name}
          width={40}
          height={40}
          loading="lazy"
          decoding="async"
          className={cn("h-10", "w-10", "rounded", "object-cover")}
        />
      ) : (
        <div className={cn("h-10", "w-10", "rounded", "bg-muted")} />
      );
    },
  },
  {
    accessorKey: "name",
    header: sortableHeader<Product>("Name"),
    size: 220,
  },
  {
    accessorKey: "sku",
    header: sortableHeader<Product>("SKU"),
    size: 160,
  },
  {
    id: "category",
    header: "Category",
    enableSorting: false,
    size: 160,
    cell: ({ row }) => row.original.category?.name ?? "—",
  },
  {
    accessorKey: "price",
    header: sortableHeader<Product>("Price"),
    size: 120,
    cell: ({ getValue }) => currency.format(Number(getValue() ?? 0)),
  },
  {
    accessorKey: "stock",
    header: sortableHeader<Product>("Stock"),
    size: 100,
  },
  {
    accessorKey: "isActive",
    header: "Active",
    enableSorting: false,
    size: 110,
    cell: ({ getValue }) => <ActiveBadge active={Boolean(getValue())} />,
  },
  {
    accessorKey: "createdAt",
    header: sortableHeader<Product>("Created"),
    size: 140,
    cell: ({ getValue }) => <DateCell value={getValue() as string | undefined} />,
  },
  {
    id: "actions",
    header: "",
    enableSorting: false,
    size: 140,
    cell: ({ row }) => (
      <RowActions
        resource="products"
        recordItemId={row.original.id}
        labels={{
          show: "Show product",
          edit: "Edit product",
          delete: "Delete product",
        }}
      />
    ),
  },
];
