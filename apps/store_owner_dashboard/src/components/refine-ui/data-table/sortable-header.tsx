"use client";

import type { Column } from "@tanstack/react-table";

import { DataTableSorter } from "./data-table-sorter";
import { cn } from "@/lib/utils";

export const sortableHeader =
  <TData,>(label: string) =>
  ({ column }: { column: Column<TData> }) => (
    <div className={cn("flex", "items-center", "gap-1")}>
      <span>{label}</span>
      <DataTableSorter column={column} />
    </div>
  );
