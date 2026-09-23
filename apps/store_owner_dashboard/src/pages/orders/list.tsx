"use client";

import { useTable } from "@refinedev/react-table";

import { DataTable } from "@/components/refine-ui/data-table/data-table";
import { ListView, ListViewHeader } from "@/components/refine-ui/views/list-view";
import { orderColumns } from "@/components/orders/order-columns";
import type { Order } from "@/types/order";

export const OrdersList = () => {
  const table = useTable<Order>({
    columns: orderColumns,
    refineCoreProps: {
      resource: "orders",
      syncWithLocation: true,
      meta: { omitListParams: true },
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

OrdersList.displayName = "OrdersList";
