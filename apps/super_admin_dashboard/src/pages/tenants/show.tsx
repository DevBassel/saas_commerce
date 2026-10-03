"use client";

import { useShow } from "@refinedev/core";

import {
  ShowView,
  ShowViewHeader,
} from "@/components/refine-ui/views/show-view";
import { TenantDetailsCard } from "@/components/tenants/tenant-details-card";
import { TenantOwnerCard } from "@/components/tenants/tenant-owner-card";
import { TenantSubscriptionCard } from "@/components/tenants/tenant-subscription-card";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { Tenant } from "@/types/tenant";

export const TenantsShow = () => {
  const { query } = useShow<Tenant>({
    resource: "platform/tenants",
  });

  const tenant = query.data?.data;

  return (
    <ShowView>
      <ShowViewHeader title={tenant?.name} hideEdit />
      {query.isLoading ? (
        <Card>
          <CardHeader>
            <CardTitle>
              <Skeleton className="h-6 w-48" />
            </CardTitle>
          </CardHeader>
          <CardContent className={cn("flex", "flex-col", "gap-4")}>
            {Array.from({ length: 6 }).map((_, index) => (
              <div
                key={`skeleton-row-${index}`}
                className={cn("flex", "flex-col", "gap-2")}
              >
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-4 w-64" />
              </div>
            ))}
          </CardContent>
        </Card>
      ) : !tenant ? (
        <p
          className={cn(
            "py-8",
            "text-center",
            "text-sm",
            "text-muted-foreground",
          )}
        >
          Tenant not found.
        </p>
      ) : (
        <>
          <div className={cn("grid", "gap-4", "grid-cols-1", "md:grid-cols-2")}>
            <TenantDetailsCard
              tenant={tenant}
              onRefetch={() => void query.refetch()}
            />
            <TenantOwnerCard tenant={tenant} />
          </div>

          <TenantSubscriptionCard tenantId={tenant.id} />
        </>
      )}
    </ShowView>
  );
};

TenantsShow.displayName = "TenantsShow";
