"use client";

import { useTable } from "@refinedev/react-table";

import { ListView, ListViewHeader } from "@/components/refine-ui/views/list-view";
import { DataTable } from "@/components/refine-ui/data-table/data-table";
import { categoryColumns } from "@/components/categories/category-columns";
import type { Category } from "@/types/category";

export const CategoriesList = () => {
  const table = useTable<Category>({
    columns: categoryColumns,
    refineCoreProps: {
      resource: "categories",
      syncWithLocation: true,
      sorters: {
        initial: [{ field: "name", order: "asc" }],
      },
    },
  });

  return (
    <ListView>
      <ListViewHeader />
      <DataTable table={table} />
    </ListView>
  );
};

CategoriesList.displayName = "CategoriesList";
