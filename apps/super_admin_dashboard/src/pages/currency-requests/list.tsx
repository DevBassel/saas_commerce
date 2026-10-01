"use client";

import { useTable } from "@refinedev/react-table";

import { currencyRequestColumns } from "@/components/currency-requests/currency-request-columns";
import { DataTable } from "@/components/refine-ui/data-table/data-table";
import {
  ListView,
  ListViewHeader,
} from "@/components/refine-ui/views/list-view";
import type { CurrencyChangeRequest } from "@/types/currency-request";

export const CurrencyRequestsList = () => {
  const table = useTable<CurrencyChangeRequest>({
    columns: currencyRequestColumns,
    refineCoreProps: {
      resource: "platform/currency-requests",
      syncWithLocation: true,
      sorters: {
        initial: [{ field: "createdAt", order: "desc" }],
      },
    },
  });

  return (
    <ListView>
      <ListViewHeader resource="platform/currency-requests" />
      <DataTable table={table} />
    </ListView>
  );
};

CurrencyRequestsList.displayName = "CurrencyRequestsList";
