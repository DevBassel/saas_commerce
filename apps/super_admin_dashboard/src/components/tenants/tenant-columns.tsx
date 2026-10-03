"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Link } from "react-router";

import { DateCell } from "@/components/refine-ui/data-table/date-cell";
import { sortableHeader } from "@/components/refine-ui/data-table/sortable-header";
import { TenantRowActions } from "@/components/tenants/tenant-row-actions";
import { TenantStatusBadge } from "@/components/tenants/tenant-status-badge";
import { cn, formatBytes, storagePercent } from "@/lib/utils";
import type { Tenant } from "@/types/tenant";

export const tenantColumns: ColumnDef<Tenant>[] = [
  {
    accessorKey: "name",
    header: sortableHeader<Tenant>("Name"),
    size: 200,
    cell: ({ getValue, row }) => (
      <Link
        to={`/tenants/show/${row.original.id}`}
        className="font-medium hover:underline"
      >
        {getValue() as string}
      </Link>
    ),
  },
  {
    accessorKey: "slug",
    header: sortableHeader<Tenant>("Slug"),
    size: 160,
    cell: ({ getValue }) => (
      <span className={cn("text-muted-foreground")}>
        {getValue() as string}
      </span>
    ),
  },
  {
    accessorKey: "subdomain",
    header: sortableHeader<Tenant>("Subdomain"),
    size: 160,
    cell: ({ getValue }) => (
      <span className={cn("text-muted-foreground")}>
        {(getValue() as string | null) ?? "—"}
      </span>
    ),
  },
  {
    accessorKey: "status",
    header: sortableHeader<Tenant>("Status"),
    size: 120,
    cell: ({ getValue }) => (
      <TenantStatusBadge status={getValue() as string} />
    ),
  },
  {
    id: "storage",
    header: "Storage",
    enableSorting: false,
    size: 180,
    cell: ({ row }) => {
      const tenant = row.original;
      return (
        <div className={cn("flex", "flex-col", "gap-1", "text-muted-foreground")}>
          <span>
            {formatBytes(tenant.storageUsedBytes)} /{" "}
            {formatBytes(tenant.storageCapacityBytes)}
          </span>
          <span className="text-xs">
            {Math.round(
              storagePercent(
                tenant.storageUsedBytes,
                tenant.storageCapacityBytes,
              ),
            )}
            %
          </span>
          <span className="text-xs">
            Schema {formatBytes(tenant.schemaSizeBytes)} /{" "}
            {formatBytes(tenant.schemaCapacityBytes)} (
            {Math.round(
              storagePercent(
                tenant.schemaSizeBytes,
                tenant.schemaCapacityBytes,
              ),
            )}
            %)
          </span>
        </div>
      );
    },
  },
  {
    accessorKey: "ownerUserId",
    header: "Owner ID",
    enableSorting: false,
    size: 120,
    cell: ({ getValue }) => (
      <span className={cn("text-muted-foreground")}>
        {(getValue() as number | null) ?? "—"}
      </span>
    ),
  },
  {
    accessorKey: "createdAt",
    header: sortableHeader<Tenant>("Created"),
    size: 140,
    cell: ({ getValue }) => (
      <DateCell value={getValue() as string | undefined} />
    ),
  },
  {
    id: "actions",
    header: "",
    enableSorting: false,
    size: 80,
    cell: ({ row }) => <TenantRowActions id={row.original.id} />,
  },
];
