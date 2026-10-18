"use client";

import { useGetIdentity } from "@refinedev/core";
import { useTable } from "@refinedev/react-table";

import { ListView, ListViewHeader } from "@/components/refine-ui/views/list-view";
import { DataTable } from "@/components/refine-ui/data-table/data-table";
import { couponColumns } from "@/components/coupons/coupon-columns";
import { canManageCatalog } from "@/constants/users";
import type { Coupon } from "@/types/coupon";
import type { ActorIdentity } from "@/types/user";

export const CouponsList = () => {
  const { data: identity } = useGetIdentity<ActorIdentity>();
  const canCreate = canManageCatalog(identity?.roles?.[0] ?? null);

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
      <ListViewHeader canCreate={canCreate} />
      <DataTable table={table} />
    </ListView>
  );
};

CouponsList.displayName = "CouponsList";
