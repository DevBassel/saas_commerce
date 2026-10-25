import { useCustom, useList } from "@refinedev/core";
import type { Tenant } from "@/types/tenant";
import type { PlatformStripeSummary } from "@/types/payments";
import {
  DashboardHeader,
  DashboardStats,
  StripeStatusCard,
  PlatformBalanceCard,
  RecentTenantsTable,
} from "./components";

export const Dashboard = () => {
  const { query, result } = useList<Tenant>({
    resource: "platform/tenants",
    pagination: { mode: "off" },
  });

  const { query: stripeQuery } = useCustom<PlatformStripeSummary>({
    url: "platform/payments/summary",
    method: "get",
  });

  const tenants = result.data ?? [];
  const isLoading = query.isLoading;

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <DashboardHeader />
      <DashboardStats tenants={tenants} isLoading={isLoading} />
      <div className="grid gap-4 sm:grid-cols-2">
        <StripeStatusCard stripeQuery={stripeQuery} />
        <PlatformBalanceCard stripeQuery={stripeQuery} />
      </div>
      <RecentTenantsTable tenants={tenants} isLoading={isLoading} />
    </div>
  );
};