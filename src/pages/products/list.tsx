"use client";

import { useTable } from "@refinedev/react-table";

import { ListView, ListViewHeader } from "@/components/refine-ui/views/list-view";
import { DataTable } from "@/components/refine-ui/data-table/data-table";
import { productColumns } from "@/components/products/product-columns";
import type { Product } from "@/types/product";

export const ProductsList = () => {
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
      <ListViewHeader />
      <DataTable table={table} />
    </ListView>
  );
};

ProductsList.displayName = "ProductsList";
