"use client";

import { useShow } from "@refinedev/core";

import { DetailRow } from "@/components/refine-ui/views/detail-row";
import { ShowView, ShowViewHeader } from "@/components/refine-ui/views/show-view";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { User } from "@/types/user";

export const UsersShow = () => {
  const { query } = useShow<User>({
    resource: "users",
    meta: { detailPath: "users/profile" },
  });
  const record = query.data?.data;

  const title = typeof record?.name === "string" ? record.name : undefined;
  const directPermissions = record?.permissions ?? [];

  return (
    <ShowView>
      <ShowViewHeader title={title} />
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
      ) : !record ? (
        <p
          className={cn(
            "py-8",
            "text-center",
            "text-sm",
            "text-muted-foreground",
          )}
        >
          User not found.
        </p>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className={cn("flex", "items-center", "gap-2")}>
              {record.name}
              {record.emailVerified ? (
                <Badge variant="secondary">Verified</Badge>
              ) : (
                <Badge variant="outline">Unverified</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <DetailRow label="Email" value={record.email} />
            <Separator />
            <DetailRow label="Role" value={record.role?.name ?? "—"} />
            <Separator />
            <DetailRow
              label="Direct permissions"
              value={
                directPermissions.length ? (
                  <span className={cn("flex", "flex-wrap", "gap-1")}>
                    {directPermissions.map((permission) => (
                      <Badge key={permission.id} variant="outline">
                        {permission.key}
                      </Badge>
                    ))}
                  </span>
                ) : (
                  "—"
                )
              }
            />
            <Separator />
            <DetailRow
              label="Created"
              value={
                record.createdAt
                  ? new Date(record.createdAt).toLocaleString()
                  : "—"
              }
            />
            <Separator />
            <DetailRow
              label="Updated"
              value={
                record.updatedAt
                  ? new Date(record.updatedAt).toLocaleString()
                  : "—"
              }
            />
          </CardContent>
        </Card>
      )}
    </ShowView>
  );
};

UsersShow.displayName = "UsersShow";
