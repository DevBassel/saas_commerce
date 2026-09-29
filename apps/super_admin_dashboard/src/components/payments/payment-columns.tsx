"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Link } from "react-router";

import { sortableHeader } from "@/components/refine-ui/data-table/sortable-header";
import { TenantStatusBadge } from "@/components/tenants/tenant-status-badge";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { PlatformPaymentTenant } from "@/types/payments";

const pauseBadgeVariant = (paused: boolean) =>
  paused ? ("destructive" as const) : ("default" as const);

export const paymentColumns: ColumnDef<PlatformPaymentTenant>[] = [
  {
    accessorKey: "name",
    header: sortableHeader<PlatformPaymentTenant>("Name"),
    size: 200,
    cell: ({ getValue, row }) => (
      <Link
        to={`/payments/show/${row.original.id}`}
        className="font-medium hover:underline"
      >
        {getValue() as string}
      </Link>
    ),
  },
  {
    accessorKey: "slug",
    header: sortableHeader<PlatformPaymentTenant>("Slug"),
    size: 160,
    cell: ({ getValue }) => (
      <span className={cn("text-muted-foreground")}>
        {getValue() as string}
      </span>
    ),
  },
  {
    accessorKey: "status",
    header: sortableHeader<PlatformPaymentTenant>("Status"),
    size: 120,
    cell: ({ getValue }) => <TenantStatusBadge status={getValue() as string} />,
  },
  {
    id: "stripe",
    header: "Stripe",
    enableSorting: false,
    size: 140,
    cell: ({ row }) =>
      row.original.stripeAccountId ? (
        <Badge variant="default">Connected</Badge>
      ) : (
        <Badge variant="secondary">Not connected</Badge>
      ),
  },
  {
    id: "payments",
    header: "Payments",
    enableSorting: false,
    size: 120,
    cell: ({ row }) => (
      <Badge variant={pauseBadgeVariant(row.original.paymentsPaused)}>
        {row.original.paymentsPaused ? "Paused" : "Active"}
      </Badge>
    ),
  },
  {
    id: "payouts",
    header: "Payouts",
    enableSorting: false,
    size: 120,
    cell: ({ row }) => (
      <Badge variant={pauseBadgeVariant(row.original.payoutsPaused)}>
        {row.original.payoutsPaused ? "Paused" : "Active"}
      </Badge>
    ),
  },
];
