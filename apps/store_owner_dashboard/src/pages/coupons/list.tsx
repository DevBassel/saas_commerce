"use client";

import { useTable } from "@refinedev/react-table";

import { ListView, ListViewHeader } from "@/components/refine-ui/views/list-view";
import { DataTable } from "@/components/refine-ui/data-table/data-table";
import { couponColumns } from "@/components/coupons/coupon-columns";
import type { Coupon } from "@/types/coupon";

export const CouponsList = () => {
  const table = useTable<Coupon>({
    columns: couponColumns,
    refineCoreProps: {
      resource: "coupons",
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

CouponsList.displayName = "CouponsList";
