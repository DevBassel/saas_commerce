"use client";

import { useGetIdentity } from "@refinedev/core";
import { useTable } from "@refinedev/react-table";

import { ListView, ListViewHeader } from "@/components/refine-ui/views/list-view";
import { DataTable } from "@/components/refine-ui/data-table/data-table";
import { categoryColumns } from "@/components/categories/category-columns";
import { canManageCatalog } from "@/constants/users";
import type { Category } from "@/types/category";
import type { ActorIdentity } from "@/types/user";

export const CategoriesList = () => {
  const { data: identity } = useGetIdentity<ActorIdentity>();
  const canCreate = canManageCatalog(identity?.roles?.[0] ?? null);

  const table = useTable<Category>({
    columns: categoryColumns,
    refineCoreProps: {
      resource: "categories",
      syncWithLocation: true,
      // The API returns a plain array and ignores list params, so this list is
      // paged and sorted entirely client-side by the data-provider fallback
      // (it fetches the full collection). Columns are intentionally
      // non-sortable to reflect that.
      sorters: {
        initial: [{ field: "name", order: "asc" }],
      },
    },
  });

  return (
    <ListView>
      <ListViewHeader canCreate={canCreate} />
      <DataTable table={table} />
    </ListView>
  );
};

CategoriesList.displayName = "CategoriesList";
