"use client";

import type { ColumnDef } from "@tanstack/react-table";

import { ActiveBadge } from "@/components/refine-ui/data-table/active-badge";
import { DateCell } from "@/components/refine-ui/data-table/date-cell";
import { RowActions } from "@/components/refine-ui/data-table/row-actions";
import { sortableHeader } from "@/components/refine-ui/data-table/sortable-header";
import { cn } from "@/lib/utils";
import type { Category } from "@/types/category";

export const categoryColumns: ColumnDef<Category>[] = [
  {
    accessorKey: "name",
    header: sortableHeader<Category>("Name"),
    size: 240,
  },
  {
    accessorKey: "slug",
    header: sortableHeader<Category>("Slug"),
    size: 200,
    cell: ({ getValue }) => (
      <span className={cn("text-muted-foreground")}>
        {getValue() as string}
      </span>
    ),
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
    header: sortableHeader<Category>("Created"),
    size: 140,
    cell: ({ getValue }) => (
      <DateCell value={getValue() as string | undefined} />
    ),
  },
  {
    id: "actions",
    header: "",
    enableSorting: false,
    size: 140,
    cell: ({ row }) => (
      <RowActions
        resource="categories"
        recordItemId={row.original.id}
        labels={{
          show: "Show category",
          edit: "Edit category",
          delete: "Delete category",
        }}
      />
    ),
  },
];
