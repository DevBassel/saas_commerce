"use client";

import { useTable } from "@refinedev/react-table";

import { DataTable } from "@/components/refine-ui/data-table/data-table";
import {
  ListView,
  ListViewHeader,
} from "@/components/refine-ui/views/list-view";
import { planColumns } from "@/components/subscription-plans/plan-columns";
import { SUBSCRIPTION_PLANS_RESOURCE } from "@/api/subscriptions.api";
import type { SubscriptionPlan } from "@/types/subscription";

export const SubscriptionPlansList = () => {
  const table = useTable<SubscriptionPlan>({
    columns: planColumns,
    refineCoreProps: {
      resource: SUBSCRIPTION_PLANS_RESOURCE,
      syncWithLocation: true,
      sorters: {
        initial: [{ field: "sortOrder", order: "asc" }],
      },
    },
  });

  return (
    <ListView>
      <ListViewHeader resource={SUBSCRIPTION_PLANS_RESOURCE} />
      <DataTable table={table} />
    </ListView>
  );
};

SubscriptionPlansList.displayName = "SubscriptionPlansList";
