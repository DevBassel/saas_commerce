"use client";

import type { ColumnDef } from "@tanstack/react-table";

import { ActiveBadge } from "@/components/refine-ui/data-table/active-badge";
import { CouponRowActions } from "@/components/coupons/coupon-row-actions";
import { DateCell } from "@/components/refine-ui/data-table/date-cell";
import { sortableHeader } from "@/components/refine-ui/data-table/sortable-header";
import {
  CouponDiscountCell,
  CouponUsageCell,
} from "@/components/coupons/coupon-cells";
import type { Coupon } from "@/types/coupon";

export const couponColumns: ColumnDef<Coupon>[] = [
  {
    accessorKey: "code",
    header: sortableHeader<Coupon>("Code"),
    size: 180,
  },
  {
    id: "discount",
    header: "Discount",
    enableSorting: false,
    size: 160,
    cell: ({ row }) => <CouponDiscountCell coupon={row.original} />,
  },
  {
    id: "usage",
    header: "Usage",
    enableSorting: false,
    size: 120,
    cell: ({ row }) => <CouponUsageCell coupon={row.original} />,
  },
  {
    accessorKey: "isActive",
    header: "Active",
    enableSorting: false,
    size: 110,
    cell: ({ getValue }) => <ActiveBadge active={Boolean(getValue())} />,
  },
  {
    accessorKey: "expiresAt",
    header: sortableHeader<Coupon>("Expires"),
    size: 140,
    cell: ({ getValue }) => <DateCell value={getValue() as string | null} />,
  },
  {
    accessorKey: "createdAt",
    header: sortableHeader<Coupon>("Created"),
    size: 140,
    cell: ({ getValue }) => (
      <DateCell value={getValue() as string | undefined} />
    ),
  },
  {
    id: "actions",
    header: "",
    enableSorting: false,
    size: 140,
    cell: ({ row }) => <CouponRowActions id={row.original.id} />,
  },
];
