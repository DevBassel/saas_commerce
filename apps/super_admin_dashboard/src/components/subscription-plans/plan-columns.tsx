"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Link } from "react-router";

import { DateCell } from "@/components/refine-ui/data-table/date-cell";
import { sortableHeader } from "@/components/refine-ui/data-table/sortable-header";
import {
  LIMIT_KEYS,
  LIMIT_TYPE_BY_KEY,
  formatLimitValue,
} from "@/components/subscription-plans/plan-labels";
import { PlanRowActions } from "@/components/subscription-plans/plan-row-actions";
import { Badge } from "@/components/ui/badge";
import { cn, formatCurrency } from "@/lib/utils";
import type { SubscriptionLimitKey, SubscriptionPlan } from "@/types/subscription";

const limitValue = (
  plan: SubscriptionPlan,
  key: SubscriptionLimitKey,
): number | null => plan.limits.find((limit) => limit.key === key)?.value ?? null;

export const planColumns: ColumnDef<SubscriptionPlan>[] = [
  {
    accessorKey: "name",
    header: sortableHeader<SubscriptionPlan>("Name"),
    size: 180,
    cell: ({ getValue, row }) => (
      <Link
        to={`/subscription-plans/edit/${row.original.id}`}
        className="font-medium hover:underline"
      >
        {getValue() as string}
      </Link>
    ),
  },
  {
    accessorKey: "slug",
    header: sortableHeader<SubscriptionPlan>("Slug"),
    size: 140,
    cell: ({ getValue }) => (
      <span className={cn("text-muted-foreground")}>
        {getValue() as string}
      </span>
    ),
  },
  {
    accessorKey: "monthlyPrice",
    header: sortableHeader<SubscriptionPlan>("Monthly"),
    size: 120,
    cell: ({ getValue, row }) =>
      formatCurrency(getValue() as number, row.original.currency),
  },
  {
    accessorKey: "yearlyPrice",
    header: sortableHeader<SubscriptionPlan>("Yearly"),
    size: 120,
    cell: ({ getValue, row }) =>
      formatCurrency(getValue() as number, row.original.currency),
  },
  {
    accessorKey: "currency",
    header: "Currency",
    enableSorting: false,
    size: 90,
    cell: ({ getValue }) => (
      <span className={cn("text-muted-foreground", "uppercase")}>
        {getValue() as string}
      </span>
    ),
  },
  {
    accessorKey: "active",
    header: sortableHeader<SubscriptionPlan>("Active"),
    size: 90,
    cell: ({ getValue }) => (
      <Badge variant={getValue() ? "default" : "secondary"}>
        {getValue() ? "Active" : "Inactive"}
      </Badge>
    ),
  },
  {
    accessorKey: "isPublic",
    header: sortableHeader<SubscriptionPlan>("Public"),
    size: 90,
    cell: ({ getValue }) => (
      <Badge variant={getValue() ? "default" : "secondary"}>
        {getValue() ? "Public" : "Private"}
      </Badge>
    ),
  },
  {
    accessorKey: "sortOrder",
    header: sortableHeader<SubscriptionPlan>("Order"),
    size: 80,
  },
  {
    accessorKey: "trialDays",
    header: sortableHeader<SubscriptionPlan>("Trial days"),
    size: 100,
  },
  {
    id: "limits",
    header: "Limits",
    enableSorting: false,
    size: 220,
    cell: ({ row }) => {
      const plan = row.original;
      return (
        <div
          className={cn(
            "flex",
            "flex-col",
            "gap-0.5",
            "text-xs",
            "text-muted-foreground",
          )}
        >
          {LIMIT_KEYS.map((key) => (
            <span key={key}>
              {key.replace(/_/g, " ").toLowerCase()}:{" "}
              {formatLimitValue(limitValue(plan, key), LIMIT_TYPE_BY_KEY[key])}
            </span>
          ))}
        </div>
      );
    },
  },
  {
    accessorKey: "createdAt",
    header: sortableHeader<SubscriptionPlan>("Created"),
    size: 130,
    cell: ({ getValue }) => (
      <DateCell value={getValue() as string | undefined} />
    ),
  },
  {
    id: "actions",
    header: "",
    enableSorting: false,
    size: 90,
    cell: ({ row }) => <PlanRowActions plan={row.original} />,
  },
];
