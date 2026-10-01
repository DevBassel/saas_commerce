"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Link } from "react-router";

import { CurrencyRequestActions } from "@/components/currency-requests/currency-request-actions";
import { DateCell } from "@/components/refine-ui/data-table/date-cell";
import { sortableHeader } from "@/components/refine-ui/data-table/sortable-header";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type {
  CurrencyChangeRequest,
  CurrencyChangeRequestStatus,
} from "@/types/currency-request";

const STATUS_VARIANT: Record<
  CurrencyChangeRequestStatus,
  "default" | "secondary" | "destructive" | "outline"
> = {
  PENDING: "secondary",
  APPROVED: "default",
  REJECTED: "destructive",
  CANCELLED: "outline",
};

export const currencyRequestColumns: ColumnDef<CurrencyChangeRequest>[] = [
  {
    id: "tenant",
    header: "Tenant",
    enableSorting: false,
    size: 200,
    cell: ({ row }) => {
      const { tenant, tenantId } = row.original;
      return (
        <div className={cn("flex", "flex-col")}>
          <Link
            to={`/tenants/show/${tenantId}`}
            className="font-medium hover:underline"
          >
            {tenant?.name ?? `Tenant #${tenantId}`}
          </Link>
          {tenant?.slug ? (
            <span className={cn("text-xs", "text-muted-foreground")}>
              {tenant.slug}
            </span>
          ) : null}
        </div>
      );
    },
  },
  {
    id: "currencies",
    header: "Change",
    enableSorting: false,
    size: 160,
    cell: ({ row }) => (
      <span className="text-sm">
        {row.original.currentCurrency.toUpperCase()} →{" "}
        <span className="font-medium">
          {row.original.requestedCurrency.toUpperCase()}
        </span>
      </span>
    ),
  },
  {
    accessorKey: "reason",
    header: "Reason",
    enableSorting: false,
    size: 220,
    cell: ({ getValue }) => (
      <span className={cn("text-muted-foreground")}>
        {(getValue() as string | null) ?? "—"}
      </span>
    ),
  },
  {
    accessorKey: "requestedByEmail",
    header: "Requested by",
    enableSorting: false,
    size: 200,
    cell: ({ getValue }) => (
      <span className={cn("text-muted-foreground")}>
        {(getValue() as string | null) ?? "—"}
      </span>
    ),
  },
  {
    accessorKey: "status",
    header: sortableHeader<CurrencyChangeRequest>("Status"),
    size: 130,
    cell: ({ getValue }) => (
      <Badge
        variant={
          STATUS_VARIANT[getValue() as CurrencyChangeRequestStatus] ??
          "secondary"
        }
      >
        {getValue() as string}
      </Badge>
    ),
  },
  {
    accessorKey: "createdAt",
    header: sortableHeader<CurrencyChangeRequest>("Created"),
    size: 140,
    cell: ({ getValue }) => (
      <DateCell value={getValue() as string | undefined} />
    ),
  },
  {
    id: "actions",
    header: "",
    enableSorting: false,
    size: 200,
    cell: ({ row }) => <CurrencyRequestActions request={row.original} />,
  },
];
