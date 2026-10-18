"use client";

import { useGetIdentity } from "@refinedev/core";
import { useTable } from "@refinedev/react-table";

import { ListView, ListViewHeader } from "@/components/refine-ui/views/list-view";
import { DataTable } from "@/components/refine-ui/data-table/data-table";
import { productColumns } from "@/components/products/product-columns";
import { canManageCatalog } from "@/constants/users";
import type { Product } from "@/types/product";
import type { ActorIdentity } from "@/types/user";

export const ProductsList = () => {
  const { data: identity } = useGetIdentity<ActorIdentity>();
  const canCreate = canManageCatalog(identity?.roles?.[0] ?? null);

  const table = useTable<Product>({
    columns: productColumns,
    refineCoreProps: {
      resource: "products",
      syncWithLocation: true,
      sorters: {
        initial: [{ field: "createdAt", order: "desc" }],
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

ProductsList.displayName = "ProductsList";
