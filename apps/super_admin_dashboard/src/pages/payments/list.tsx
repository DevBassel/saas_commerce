"use client";

import { useTable } from "@refinedev/react-table";

import { DataTable } from "@/components/refine-ui/data-table/data-table";
import {
  ListView,
  ListViewHeader,
} from "@/components/refine-ui/views/list-view";
import { paymentColumns } from "@/components/payments/payment-columns";
import type { PlatformPaymentTenant } from "@/types/payments";

export const PaymentsList = () => {
  const table = useTable<PlatformPaymentTenant>({
    columns: paymentColumns,
    refineCoreProps: {
      resource: "platform/payments",
      syncWithLocation: true,
      sorters: {
        initial: [{ field: "name", order: "asc" }],
      },
    },
  });

  return (
    <ListView>
      <ListViewHeader resource="platform/payments" />
      <DataTable table={table} />
    </ListView>
  );
};

PaymentsList.displayName = "PaymentsList";
