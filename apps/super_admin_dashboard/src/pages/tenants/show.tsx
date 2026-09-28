"use client";

import { useShow } from "@refinedev/core";
import { format } from "date-fns";

import { TenantStatusActions } from "@/components/tenants/tenant-status-actions";
import { TenantStatusBadge } from "@/components/tenants/tenant-status-badge";
import { DetailRow } from "@/components/refine-ui/views/detail-row";
import {
  ShowView,
  ShowViewHeader,
} from "@/components/refine-ui/views/show-view";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, formatBytes, storagePercent } from "@/lib/utils";
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
          <Card>
            <CardHeader>
              <div
                className={cn(
                  "flex",
                  "items-center",
                  "justify-between",
                  "gap-4",
                )}
              >
                <div className={cn("flex", "flex-col", "gap-1.5")}>
                  <CardTitle className={cn("flex", "items-center", "gap-3")}>
                    Details
                    <TenantStatusBadge status={tenant.status} />
                  </CardTitle>
                  <CardDescription>Platform tenant information</CardDescription>
                </div>
                <TenantStatusActions
                  tenant={tenant}
                  onToggled={() => {
                    void query.refetch();
                  }}
                />
              </div>
            </CardHeader>
            <Separator />
            <CardContent>
              <div
                className={cn(
                  "grid",
                  "gap-6",
                  "sm:grid-cols-2",
                  "lg:grid-cols-3",
                )}
              >
                <DetailRow label="Name" value={tenant.name} />
                <DetailRow label="Slug" value={tenant.slug} />
                <DetailRow label="Schema" value={tenant.schemaName} />
                <DetailRow
                  label="Subdomain"
                  value={tenant.subdomain ?? "—"}
                />
                <DetailRow
                  label="Owner User ID"
                  value={tenant.ownerUserId ?? "—"}
                />
                <DetailRow label="Status" value={tenant.status} />
                <DetailRow
                  label="Created"
                  value={format(
                    new Date(tenant.createdAt),
                    "MMM d, yyyy HH:mm",
                  )}
                />
                <DetailRow
                  label="Updated"
                  value={format(
                    new Date(tenant.updatedAt),
                    "MMM d, yyyy HH:mm",
                  )}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Owner</CardTitle>
              <CardDescription>Store owner account</CardDescription>
            </CardHeader>
            <Separator />
            <CardContent>
              {tenant.owner ? (
                <div
                  className={cn(
                    "grid",
                    "gap-6",
                    "sm:grid-cols-2",
                    "lg:grid-cols-3",
                  )}
                >
                  <DetailRow label="Name" value={tenant.owner.name} />
                  <DetailRow label="Email" value={tenant.owner.email} />
                  <DetailRow
                    label="Role"
                    value={
                      tenant.owner.role ? (
                        <Badge variant="outline">
                          {tenant.owner.role.name}
                        </Badge>
                      ) : (
                        "—"
                      )
                    }
                  />
                  <DetailRow
                    label="Permissions"
                    value={
                      tenant.owner.permissions.length > 0 ? (
                        <span className={cn("flex", "flex-wrap", "gap-2")}>
                          {tenant.owner.permissions.map((permission) => (
                            <Badge
                              key={permission.key}
                              variant="outline"
                              title={permission.key}
                            >
                              {permission.name}
                            </Badge>
                          ))}
                        </span>
                      ) : (
                        "—"
                      )
                    }
                  />
                </div>
              ) : (
                <p className={cn("text-sm", "text-muted-foreground")}>
                  No owner assigned.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Storage</CardTitle>
              <CardDescription>Disk usage for this tenant</CardDescription>
            </CardHeader>
            <Separator />
            <CardContent>
              <div className={cn("flex", "flex-col", "gap-6")}>
                <div
                  className={cn(
                    "grid",
                    "gap-6",
                    "sm:grid-cols-2",
                    "lg:grid-cols-3",
                  )}
                >
                  <DetailRow
                    label="Used"
                    value={formatBytes(tenant.storageUsedBytes)}
                  />
                  <DetailRow
                    label="Used %"
                    value={`${Math.round(
                      storagePercent(
                        tenant.storageUsedBytes,
                        tenant.storageCapacityBytes,
                      ),
                    )}%`}
                  />
                  <DetailRow
                    label="Capacity"
                    value={formatBytes(tenant.storageCapacityBytes)}
                  />
                </div>
                <Progress
                  value={storagePercent(
                    tenant.storageUsedBytes,
                    tenant.storageCapacityBytes,
                  )}
                />
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </ShowView>
  );
};

TenantsShow.displayName = "TenantsShow";
