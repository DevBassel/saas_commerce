"use client";

import { useTable } from "@refinedev/react-table";

import { DataTable } from "@/components/refine-ui/data-table/data-table";
import {
  ListView,
  ListViewHeader,
} from "@/components/refine-ui/views/list-view";
import { tenantColumns } from "@/components/tenants/tenant-columns";
import { TenantTableToolbar } from "@/components/tenants/tenant-table-toolbar";
import type { Tenant } from "@/types/tenant";

export const TenantsList = () => {
  const table = useTable<Tenant>({
    columns: tenantColumns,
    refineCoreProps: {
      resource: "platform/tenants",
      syncWithLocation: true,
      sorters: {
        initial: [{ field: "createdAt", order: "desc" }],
      },
    },
  });

  return (
    <ListView>
      <ListViewHeader resource="platform/tenants" />
      <TenantTableToolbar table={table} />
      <DataTable table={table} />
    </ListView>
  );
};

TenantsList.displayName = "TenantsList";
