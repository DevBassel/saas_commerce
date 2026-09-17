"use client";

import { useShow } from "@refinedev/core";

import { ShowView, ShowViewHeader } from "@/components/refine-ui/views/show-view";
import { ActiveBadge } from "@/components/refine-ui/data-table/active-badge";
import { DetailRow } from "@/components/refine-ui/views/detail-row";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type { Category } from "@/types/category";

export const CategoriesShow = () => {
  const { query } = useShow<Category>({ resource: "categories" });
  const record = query.data?.data;

  const title =
    typeof query.data?.data?.name === "string" ? query.data.data.name : undefined;

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
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={`skeleton-row-${index}`} className={cn("flex", "flex-col", "gap-2")}>
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
            "text-muted-foreground"
          )}
        >
          Category not found.
        </p>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className={cn("flex", "items-center", "gap-2")}>
              {record.name}
              <ActiveBadge active={record.isActive} />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <DetailRow label="Slug" value={record.slug} />
            <Separator />
            <DetailRow
              label="Description"
              value={record.description || "—"}
            />
            <Separator />
            <DetailRow
              label="Created"
              value={new Date(record.createdAt).toLocaleString()}
            />
            <Separator />
            <DetailRow
              label="Updated"
              value={new Date(record.updatedAt).toLocaleString()}
            />
          </CardContent>
        </Card>
      )}
    </ShowView>
  );
};

CategoriesShow.displayName = "CategoriesShow";
