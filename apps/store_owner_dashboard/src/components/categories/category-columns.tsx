"use client";

import type { ColumnDef } from "@tanstack/react-table";

import { ActiveBadge } from "@/components/refine-ui/data-table/active-badge";
import { CategoryRowActions } from "@/components/categories/category-row-actions";
import { DateCell } from "@/components/refine-ui/data-table/date-cell";
import { cn } from "@/lib/utils";
import type { Category } from "@/types/category";

// GET /categories returns a plain array and ignores list params, so the table
// sorts and paginates client-side (data-provider fallback). Headers are kept
// non-sortable to avoid advertising server-side sorting that does not exist.
export const categoryColumns: ColumnDef<Category>[] = [
  {
    accessorKey: "name",
    header: "Name",
    enableSorting: false,
    size: 240,
  },
  {
    accessorKey: "slug",
    header: "Slug",
    enableSorting: false,
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
    header: "Created",
    enableSorting: false,
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
    cell: ({ row }) => <CategoryRowActions id={row.original.id} />,
  },
];
